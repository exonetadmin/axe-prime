import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, authRateLimit } from "../lib/rate-limit";

describe("Rate Limiter", () => {
  beforeEach(() => {
    vitest.useFakeTimers();
  });

  it("should allow requests within limit", () => {
    const result = checkRateLimit("test-client", authRateLimit);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(authRateLimit.maxRequests);
  });

  it("should block requests over limit", () => {
    const key = "test-client-limit";
    
    for (let i = 0; i < authRateLimit.maxRequests; i++) {
      const result = checkRateLimit(key, authRateLimit);
      expect(result.allowed).toBe(true);
    }

    const result = checkRateLimit(key, authRateLimit);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should reset after window expires", () => {
    const key = "test-client-reset";
    
    for (let i = 0; i < authRateLimit.maxRequests; i++) {
      checkRateLimit(key, authRateLimit);
    }

    const blocked = checkRateLimit(key, authRateLimit);
    expect(blocked.allowed).toBe(false);

    vitest.advanceTimersByTime(authRateLimit.windowMs + 1000);

    const allowed = checkRateLimit(key, authRateLimit);
    expect(allowed.allowed).toBe(true);
  });

  it("should track different clients separately", () => {
    const key1 = "client-1";
    const key2 = "client-2";

    for (let i = 0; i < authRateLimit.maxRequests; i++) {
      checkRateLimit(key1, authRateLimit);
    }

    const result1 = checkRateLimit(key1, authRateLimit);
    const result2 = checkRateLimit(key2, authRateLimit);
    
    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });
});
