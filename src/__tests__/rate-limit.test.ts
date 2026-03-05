import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, consumeRateLimit } from "@/lib/rate-limit";

// Reset the in-memory store between tests by re-importing
beforeEach(() => {
  vi.resetModules();
});

// Helper: get a fresh module instance to reset the store
async function freshModule() {
  const mod = await import("@/lib/rate-limit");
  return mod;
}

describe("rate-limit", () => {
  it("allows requests under the limit", async () => {
    const { checkRateLimit, consumeRateLimit } = await freshModule();
    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it("decrements remaining after each consumption", async () => {
    const { checkRateLimit, consumeRateLimit } = await freshModule();
    consumeRateLimit("1.2.3.4");
    consumeRateLimit("1.2.3.4");

    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("blocks after 5 requests", async () => {
    const { checkRateLimit, consumeRateLimit } = await freshModule();
    for (let i = 0; i < 5; i++) {
      consumeRateLimit("1.2.3.4");
    }

    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", async () => {
    const { checkRateLimit, consumeRateLimit } = await freshModule();
    for (let i = 0; i < 5; i++) {
      consumeRateLimit("1.1.1.1");
    }

    expect(checkRateLimit("1.1.1.1").allowed).toBe(false);
    expect(checkRateLimit("2.2.2.2").allowed).toBe(true);
  });

  it("resets after the time window expires", async () => {
    const { checkRateLimit, consumeRateLimit } = await freshModule();
    for (let i = 0; i < 5; i++) {
      consumeRateLimit("1.2.3.4");
    }
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);

    // Advance time past the 24h window
    vi.useFakeTimers();
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);

    vi.useRealTimers();
  });
});
