import Anthropic from "@anthropic-ai/sdk";
import { Lens, Concept, Connection } from "../types";
import {
  DECOMPOSE_PROMPT,
  EXPLORE_PROMPT,
  CONNECT_PROMPT,
  SYNTHESIZE_PROMPT,
} from "./prompts";

const client = new Anthropic();

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

export async function decompose(question: string): Promise<Lens[]> {
  const response = await client.messages.create({
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
    throw new Error("No tool use in decompose response");
  }

  const input = toolBlock.input as {
    lenses: { name: string; description: string }[];
  };

  return input.lenses.map((l, i) => ({
    id: `lens-${i}`,
    name: l.name,
    description: l.description,
    concepts: [],
  }));
}

export async function explore(
  question: string,
  lens: Lens
): Promise<Concept[]> {
  const response = await client.messages.create({
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
    throw new Error("No tool use in explore response");
  }

  const input = toolBlock.input as {
    concepts: { name: string; description: string; thinkers: string[] }[];
  };

  return input.concepts.map((c, i) => ({
    id: `${lens.id}-concept-${i}`,
    lensId: lens.id,
    name: c.name,
    description: c.description,
    thinkers: c.thinkers,
  }));
}

export async function connect(
  question: string,
  lenses: Lens[]
): Promise<Connection[]> {
  const conceptSummary = lenses
    .map(
      (l) =>
        `Lens: ${l.name}\nConcepts:\n${l.concepts
          .map((c) => `  - ${c.name} (${c.id}): ${c.description}`)
          .join("\n")}`
    )
    .join("\n\n");

  const response = await client.messages.create({
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
    throw new Error("No tool use in connect response");
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

  return input.connections
    .filter(
      (c) =>
        allConceptIds.has(c.sourceConceptId) &&
        allConceptIds.has(c.targetConceptId)
    )
    .map((c, i) => ({
      id: `connection-${i}`,
      sourceConceptId: c.sourceConceptId,
      targetConceptId: c.targetConceptId,
      description: c.description,
    }));
}

export async function synthesize(
  question: string,
  lenses: Lens[],
  connections: Connection[]
): Promise<string> {
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

  const response = await client.messages.create({
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
    throw new Error("No text in synthesize response");
  }

  return textBlock.text;
}
