import { describe, expect, it } from "vitest";
import { normalizeLlmError } from "../llmService";

describe("normalizeLlmError", () => {
  it("handles unauthorized", () => {
    const error = normalizeLlmError({ status: 401, message: "Unauthorized" });
    expect(error.code).toBe("unauthorized");
    expect(error.message).toMatch("APIキー");
  });

  it("handles rate limit", () => {
    const error = normalizeLlmError({ status: 429, message: "Too many" });
    expect(error.code).toBe("rate_limit");
  });

  it("handles server errors", () => {
    const error = normalizeLlmError({ status: 503, message: "Down" });
    expect(error.code).toBe("server_error");
  });

  it("handles network failures", () => {
    const error = normalizeLlmError({ code: "ENOTFOUND", message: "fetch failed" });
    expect(error.code).toBe("network_error");
  });

  it("handles aborts", () => {
    const error = normalizeLlmError({ name: "AbortError" });
    expect(error.code).toBe("aborted");
  });

  it("falls back to unknown", () => {
    const error = normalizeLlmError(new Error("something broke"));
    expect(error.code).toBe("unknown");
  });
});
