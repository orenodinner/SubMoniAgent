"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const llmService_1 = require("../llmService");
(0, vitest_1.describe)("normalizeLlmError", () => {
    (0, vitest_1.it)("handles unauthorized", () => {
        const error = (0, llmService_1.normalizeLlmError)({ status: 401, message: "Unauthorized" });
        (0, vitest_1.expect)(error.code).toBe("unauthorized");
        (0, vitest_1.expect)(error.message).toMatch("APIキー");
    });
    (0, vitest_1.it)("handles rate limit", () => {
        const error = (0, llmService_1.normalizeLlmError)({ status: 429, message: "Too many" });
        (0, vitest_1.expect)(error.code).toBe("rate_limit");
    });
    (0, vitest_1.it)("handles server errors", () => {
        const error = (0, llmService_1.normalizeLlmError)({ status: 503, message: "Down" });
        (0, vitest_1.expect)(error.code).toBe("server_error");
    });
    (0, vitest_1.it)("handles network failures", () => {
        const error = (0, llmService_1.normalizeLlmError)({ code: "ENOTFOUND", message: "fetch failed" });
        (0, vitest_1.expect)(error.code).toBe("network_error");
    });
    (0, vitest_1.it)("handles aborts", () => {
        const error = (0, llmService_1.normalizeLlmError)({ name: "AbortError" });
        (0, vitest_1.expect)(error.code).toBe("aborted");
    });
    (0, vitest_1.it)("falls back to unknown", () => {
        const error = (0, llmService_1.normalizeLlmError)(new Error("something broke"));
        (0, vitest_1.expect)(error.code).toBe("unknown");
    });
});
