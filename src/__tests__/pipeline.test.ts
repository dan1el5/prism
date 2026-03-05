import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Anthropic SDK before importing pipeline
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      static APIError = class APIError extends Error {
        status: number;
        constructor(status: number, body: unknown, message: string, headers: unknown) {
          super(message);
          this.status = status;
        }
      };
    },
  };
});

import { decompose, explore, connect, synthesize, PipelineError } from "@/lib/agent/pipeline";
import type { Lens } from "@/lib/types";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("decompose", () => {
  it("returns lenses from a valid tool_use response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "provide_lenses",
          input: {
            lenses: [
              { name: "Historical", description: "Through the lens of history" },
              { name: "Scientific", description: "Through the lens of science" },
            ],
          },
        },
      ],
    });

    const lenses = await decompose("What is consciousness?");
    expect(lenses).toHaveLength(2);
    expect(lenses[0]).toMatchObject({
      id: "lens-0",
      name: "Historical",
      description: "Through the lens of history",
      concepts: [],
    });
    expect(lenses[1].id).toBe("lens-1");
  });

  it("throws PipelineError when no tool_use block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot do that" }],
    });

    const promise = decompose("test").catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = await promise;
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.message).toContain("No tool use in decompose response");
  });

  it("throws PipelineError when lenses array is empty", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", name: "provide_lenses", input: { lenses: [] } },
      ],
    });

    const promise = decompose("test").catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = await promise;
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.message).toContain("Model returned empty lenses");
  });
});

describe("explore", () => {
  const lens: Lens = {
    id: "lens-0",
    name: "Historical",
    description: "Through history",
    concepts: [],
  };

  it("returns concepts mapped to the lens", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "provide_concepts",
          input: {
            concepts: [
              { name: "Dualism", description: "Mind-body split", thinkers: ["Descartes"] },
            ],
          },
        },
      ],
    });

    const concepts = await explore("What is consciousness?", lens);
    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toMatchObject({
      id: "lens-0-concept-0",
      lensId: "lens-0",
      name: "Dualism",
      thinkers: ["Descartes"],
    });
  });

  it("defaults thinkers to empty array if missing", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "provide_concepts",
          input: {
            concepts: [
              { name: "Concept", description: "Desc", thinkers: undefined },
            ],
          },
        },
      ],
    });

    const concepts = await explore("test", lens);
    expect(concepts[0].thinkers).toEqual([]);
  });
});

describe("connect", () => {
  const lenses: Lens[] = [
    {
      id: "lens-0",
      name: "A",
      description: "A",
      concepts: [
        { id: "lens-0-concept-0", lensId: "lens-0", name: "C1", description: "D1", thinkers: [] },
      ],
    },
    {
      id: "lens-1",
      name: "B",
      description: "B",
      concepts: [
        { id: "lens-1-concept-0", lensId: "lens-1", name: "C2", description: "D2", thinkers: [] },
      ],
    },
  ];

  it("returns valid connections and filters invalid concept IDs", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "provide_connections",
          input: {
            connections: [
              { sourceConceptId: "lens-0-concept-0", targetConceptId: "lens-1-concept-0", description: "related" },
              { sourceConceptId: "lens-0-concept-0", targetConceptId: "invalid-id", description: "bad" },
            ],
          },
        },
      ],
    });

    const connections = await connect("test", lenses);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      id: "connection-0",
      sourceConceptId: "lens-0-concept-0",
      targetConceptId: "lens-1-concept-0",
    });
  });
});

describe("synthesize", () => {
  it("returns text content from the response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "A deep synthesis of the topic..." }],
    });

    const result = await synthesize("test", [], []);
    expect(result).toBe("A deep synthesis of the topic...");
  });

  it("throws when no text block in response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", name: "something", input: {} }],
    });

    const promise = synthesize("test", [], []).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = await promise;
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.message).toContain("No text in synthesize response");
  });
});

describe("retry behavior", () => {
  it("retries on transient API errors then succeeds", async () => {
    const APIError = (await import("@anthropic-ai/sdk")).default.APIError;

    mockCreate
      .mockRejectedValueOnce(new APIError(500, {}, "Server error", new Headers()))
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            name: "provide_lenses",
            input: {
              lenses: [{ name: "Retry", description: "Worked on retry" }],
            },
          },
        ],
      });

    const promise = decompose("test");
    await vi.advanceTimersByTimeAsync(2000);
    const lenses = await promise;
    expect(lenses).toHaveLength(1);
    expect(lenses[0].name).toBe("Retry");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const APIError = (await import("@anthropic-ai/sdk")).default.APIError;

    mockCreate.mockRejectedValueOnce(new APIError(401, {}, "Bad key", new Headers()));

    await expect(decompose("test")).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe("missing API key", () => {
  it("throws config error when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    vi.resetModules();
    const { decompose: freshDecompose } = await import("@/lib/agent/pipeline");

    await expect(freshDecompose("test")).rejects.toThrow("ANTHROPIC_API_KEY is not configured");
  });
});
