import OpenAIProvider from "./llm/OpenAIProvider";
import type { ChatMessage, ToolCall, ToolDefinition } from "./llm/types";

export type StreamChunk = string | ToolCall;

const provider = new OpenAIProvider();

export async function* streamResponse(
  messages: ChatMessage[],
  options: {
    model: string;
    apiKey: string;
    tools?: ToolDefinition[];
    signal?: AbortSignal;
    baseURL?: string;
    defaultHeaders?: Record<string, string>;
  }
): AsyncGenerator<StreamChunk> {
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

export type NormalizedLlmError = {
  code:
    | "unauthorized"
    | "rate_limit"
    | "server_error"
    | "network_error"
    | "aborted"
    | "invalid_request"
    | "unknown";
  message: string;
  status?: number;
  rawMessage?: string;
};

export function normalizeLlmError(error: unknown): NormalizedLlmError {
  const err = error as { status?: number; code?: string; message?: string; name?: string; error?: { message?: string } };
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
