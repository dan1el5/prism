import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { PipelineError, classifyError } from "@/lib/agent/pipeline";

function makeAPIError(status: number, message: string) {
  const headers = new Headers({ "content-type": "application/json" });
  return new Anthropic.APIError(status, { type: "error", error: { type: "api_error", message } }, message, headers);
}

describe("PipelineError", () => {
  it("preserves category and retryable flag", () => {
    const err = new PipelineError("test", "api", true, "decompose");
    expect(err.message).toBe("test");
    expect(err.category).toBe("api");
    expect(err.retryable).toBe(true);
    expect(err.stage).toBe("decompose");
    expect(err.name).toBe("PipelineError");
  });

  it("is an instance of Error", () => {
    const err = new PipelineError("test", "config", false);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PipelineError);
  });
});

describe("classifyError", () => {
  it("passes through PipelineError unchanged", () => {
    const original = new PipelineError("already classified", "config", false);
    const result = classifyError(original);
    expect(result).toBe(original);
  });

  it("classifies 429 as rate_limit (retryable)", () => {
    const result = classifyError(makeAPIError(429, "Rate limited"));
    expect(result.category).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("classifies 401 as config (not retryable)", () => {
    const result = classifyError(makeAPIError(401, "Invalid key"));
    expect(result.category).toBe("config");
    expect(result.retryable).toBe(false);
  });

  it("classifies 500+ as api (retryable)", () => {
    const result = classifyError(makeAPIError(500, "Internal"));
    expect(result.category).toBe("api");
    expect(result.retryable).toBe(true);
  });

  it("classifies 400 as api (not retryable)", () => {
    const result = classifyError(makeAPIError(400, "Bad request"));
    expect(result.category).toBe("api");
    expect(result.retryable).toBe(false);
  });

  it("classifies timeout messages as timeout (retryable)", () => {
    const result = classifyError(new Error("The operation was aborted due to timeout"));
    expect(result.category).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("classifies AbortError as timeout (retryable)", () => {
    const result = classifyError(new Error("AbortError: signal timed out"));
    expect(result.category).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("classifies unknown errors as unknown (not retryable)", () => {
    const result = classifyError(new Error("something unexpected"));
    expect(result.category).toBe("unknown");
    expect(result.retryable).toBe(false);
  });

  it("handles non-Error values", () => {
    const result = classifyError("string error");
    expect(result.category).toBe("unknown");
    expect(result.message).toBe("string error");
  });
});
