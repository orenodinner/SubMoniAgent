"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamResponse = streamResponse;
exports.normalizeLlmError = normalizeLlmError;
const OpenAIProvider_1 = __importDefault(require("./llm/OpenAIProvider"));
const provider = new OpenAIProvider_1.default();
async function* streamResponse(messages, options) {
    provider.initialize({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        defaultHeaders: options.defaultHeaders,
    });
    const stream = provider.streamResponse({
        messages,
        model: options.model,
        tools: options.tools,
        signal: options.signal,
    });
    for await (const chunk of stream) {
        yield chunk;
    }
}
function normalizeLlmError(error) {
    const err = error;
    const rawMessage = err?.error?.message || err?.message;
    // Abort (ユーザーによる停止)
    if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
        return {
            code: "aborted",
            message: "リクエストを中断しました。",
            rawMessage,
        };
    }
    // HTTP ステータスベースの分類
    if (typeof err?.status === "number") {
        if (err.status === 401) {
            return {
                code: "unauthorized",
                status: err.status,
                message: "APIキーが正しくありません。設定を確認してください。",
                rawMessage,
            };
        }
        if (err.status === 429) {
            return {
                code: "rate_limit",
                status: err.status,
                message: "リクエストが多すぎます。しばらく待ってから再試行してください。",
                rawMessage,
            };
        }
        if (err.status >= 500) {
            return {
                code: "server_error",
                status: err.status,
                message: "AIサービス側でエラーが発生しています。時間をおいて再試行してください。",
                rawMessage,
            };
        }
    }
    // ネットワークエラー
    const messageText = rawMessage || "";
    const networkCodes = ["ENOTFOUND", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"];
    if (networkCodes.includes(err?.code ?? "") || /fetch failed|network\s?error/i.test(messageText)) {
        return {
            code: "network_error",
            message: "インターネット接続を確認してください。",
            rawMessage,
        };
    }
    // バリデーションなどの 4xx
    if (typeof err?.status === "number" && err.status < 500) {
        return {
            code: "invalid_request",
            status: err.status,
            message: rawMessage || "リクエスト内容を確認してください。",
            rawMessage,
        };
    }
    return {
        code: "unknown",
        message: rawMessage || "AIサービスの呼び出し中に問題が発生しました。",
        rawMessage,
    };
}
