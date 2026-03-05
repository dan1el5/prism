import Anthropic from "@anthropic-ai/sdk";
import { Lens, Concept, Connection } from "../types";
import {
  DECOMPOSE_PROMPT,
  EXPLORE_PROMPT,
  CONNECT_PROMPT,
  SYNTHESIZE_PROMPT,
} from "./prompts";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;
const API_TIMEOUT_MS = 30_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new PipelineError(
        "ANTHROPIC_API_KEY is not configured",
        "config",
        false
      );
    }
    client = new Anthropic();
  }
  return client;
}

// Structured error types for observability
export type ErrorCategory = "config" | "api" | "rate_limit" | "parse" | "timeout" | "unknown";

export class PipelineError extends Error {
  category: ErrorCategory;
  retryable: boolean;
  stage?: string;

  constructor(message: string, category: ErrorCategory, retryable: boolean, stage?: string) {
    super(message);
    this.name = "PipelineError";
    this.category = category;
    this.retryable = retryable;
    this.stage = stage;
  }
}

export function classifyError(err: unknown): PipelineError {
  if (err instanceof PipelineError) return err;

  const message = err instanceof Error ? err.message : String(err);

  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) {
      return new PipelineError("API rate limit reached. Try again shortly.", "rate_limit", true);
    }
    if (err.status === 401) {
      return new PipelineError("Invalid API key", "config", false);
    }
    if (err.status && err.status >= 500) {
      return new PipelineError(`Anthropic API error (${err.status})`, "api", true);
    }
    return new PipelineError(`API error: ${message}`, "api", err.status !== 400);
  }

  if (message.includes("timeout") || message.includes("AbortError")) {
    return new PipelineError("Request timed out", "timeout", true);
  }

  return new PipelineError(message, "unknown", false);
}

async function withRetry<T>(
  stage: string,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  let lastError: PipelineError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const timer = AbortSignal.timeout(API_TIMEOUT_MS);

    try {
      const start = Date.now();
      const result = await fn(timer);
      const duration = Date.now() - start;
      console.log(`[prism] ${stage} completed in ${duration}ms (attempt ${attempt + 1})`);
      return result;
    } catch (err) {
      lastError = classifyError(err);
      lastError.stage = stage;

      console.warn(
        `[prism] ${stage} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): [${lastError.category}] ${lastError.message}`
      );

      if (!lastError.retryable || attempt === MAX_RETRIES) break;

      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError!;
}

export async function decompose(question: string): Promise<Lens[]> {
  return withRetry("decompose", async () => {
    const response = await getClient().messages.create({
      model: HAIKU,
      max_tokens: 1024,
      system: DECOMPOSE_PROMPT,
      messages: [{ role: "user", content: `Question: "${question}"` }],
      tools: [
        {
          name: "provide_lenses",
          description: "Provide the lenses for exploring the question",
          input_schema: {
            type: "object" as const,
            properties: {
              lenses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["name", "description"],
                },
              },
            },
            required: ["lenses"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "provide_lenses" },
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new PipelineError("No tool use in decompose response", "parse", true);
    }

    const input = toolBlock.input as {
      lenses: { name: string; description: string }[];
    };

    if (!Array.isArray(input.lenses) || input.lenses.length === 0) {
      throw new PipelineError("Model returned empty lenses", "parse", true);
    }

    return input.lenses.map((l, i) => ({
      id: `lens-${i}`,
      name: l.name,
      description: l.description,
      concepts: [],
    }));
  });
}

export async function explore(
  question: string,
  lens: Lens
): Promise<Concept[]> {
  return withRetry(`explore(${lens.name})`, async () => {
    const response = await getClient().messages.create({
      model: HAIKU,
      max_tokens: 2048,
      system: EXPLORE_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: "${question}"\nLens: ${lens.name} — ${lens.description}`,
        },
      ],
      tools: [
        {
          name: "provide_concepts",
          description: "Provide the concepts discovered through this lens",
          input_schema: {
            type: "object" as const,
            properties: {
              concepts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    thinkers: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["name", "description", "thinkers"],
                },
              },
            },
            required: ["concepts"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "provide_concepts" },
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new PipelineError("No tool use in explore response", "parse", true);
    }

    const input = toolBlock.input as {
      concepts: { name: string; description: string; thinkers: string[] }[];
    };

    if (!Array.isArray(input.concepts) || input.concepts.length === 0) {
      throw new PipelineError(`Model returned no concepts for lens "${lens.name}"`, "parse", true);
    }

    return input.concepts.map((c, i) => ({
      id: `${lens.id}-concept-${i}`,
      lensId: lens.id,
      name: c.name,
      description: c.description,
      thinkers: c.thinkers || [],
    }));
  });
}

export async function connect(
  question: string,
  lenses: Lens[]
): Promise<Connection[]> {
  return withRetry("connect", async () => {
    const conceptSummary = lenses
      .map(
        (l) =>
          `Lens: ${l.name}\nConcepts:\n${l.concepts
            .map((c) => `  - ${c.name} (${c.id}): ${c.description}`)
            .join("\n")}`
      )
      .join("\n\n");

    const response = await getClient().messages.create({
      model: HAIKU,
      max_tokens: 2048,
      system: CONNECT_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: "${question}"\n\n${conceptSummary}`,
        },
      ],
      tools: [
        {
          name: "provide_connections",
          description: "Provide cross-domain connections between concepts",
          input_schema: {
            type: "object" as const,
            properties: {
              connections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sourceConceptId: { type: "string" },
                    targetConceptId: { type: "string" },
                    description: { type: "string" },
                  },
                  required: [
                    "sourceConceptId",
                    "targetConceptId",
                    "description",
                  ],
                },
              },
            },
            required: ["connections"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "provide_connections" },
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new PipelineError("No tool use in connect response", "parse", true);
    }

    const input = toolBlock.input as {
      connections: {
        sourceConceptId: string;
        targetConceptId: string;
        description: string;
      }[];
    };

    // Filter to only valid concept IDs
    const allConceptIds = new Set(
      lenses.flatMap((l) => l.concepts.map((c) => c.id))
    );

    const valid = input.connections.filter(
      (c) =>
        allConceptIds.has(c.sourceConceptId) &&
        allConceptIds.has(c.targetConceptId)
    );

    const dropped = input.connections.length - valid.length;
    if (dropped > 0) {
      console.warn(`[prism] connect: dropped ${dropped}/${input.connections.length} connections with invalid concept IDs`);
    }

    return valid.map((c, i) => ({
      id: `connection-${i}`,
      sourceConceptId: c.sourceConceptId,
      targetConceptId: c.targetConceptId,
      description: c.description,
    }));
  });
}

export async function synthesize(
  question: string,
  lenses: Lens[],
  connections: Connection[]
): Promise<string> {
  return withRetry("synthesize", async () => {
    const conceptSummary = lenses
      .map(
        (l) =>
          `Lens: ${l.name}\nConcepts:\n${l.concepts
            .map((c) => `  - ${c.name}: ${c.description}`)
            .join("\n")}`
      )
      .join("\n\n");

    const connectionSummary = connections
      .map((c) => {
        const source = lenses
          .flatMap((l) => l.concepts)
          .find((concept) => concept.id === c.sourceConceptId);
        const target = lenses
          .flatMap((l) => l.concepts)
          .find((concept) => concept.id === c.targetConceptId);
        return `  - ${source?.name ?? c.sourceConceptId} <-> ${target?.name ?? c.targetConceptId}: ${c.description}`;
      })
      .join("\n");

    const response = await getClient().messages.create({
      model: SONNET,
      max_tokens: 2048,
      system: SYNTHESIZE_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: "${question}"\n\n${conceptSummary}\n\nCross-domain connections:\n${connectionSummary}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new PipelineError("No text in synthesize response", "parse", true);
    }

    return textBlock.text;
  });
}
