"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
/**
 * OpenAI Chat Completions を利用した LLM プロバイダー実装。
 * ストリーミングでの応答とツールコールの組み立てを担当する。
 */
class OpenAIProvider {
    initialize(options) {
        if (!options.apiKey) {
            throw new Error("OpenAI API キーが設定されていません。設定画面で入力してください。");
        }
        // APIキーが変わった場合のみクライアントを再生成する
        const needsNewClient = !this.client ||
            this.apiKey !== options.apiKey ||
            this.baseURL !== options.baseURL ||
            JSON.stringify(this.defaultHeaders) !== JSON.stringify(options.defaultHeaders);
        if (needsNewClient) {
            this.client = new openai_1.default({
                apiKey: options.apiKey,
                baseURL: options.baseURL,
                defaultHeaders: options.defaultHeaders,
            });
            this.apiKey = options.apiKey;
            this.baseURL = options.baseURL;
            this.defaultHeaders = options.defaultHeaders;
        }
    }
    async checkConnection() {
        if (!this.client)
            return false;
        try {
            await this.client.models.list();
            return true;
        }
        catch {
            return false;
        }
    }
    toMessages(messages) {
        return messages.map((msg) => {
            if (msg.role === "tool") {
                return {
                    role: "tool",
                    content: msg.content,
                    tool_call_id: msg.tool_call_id,
                    name: msg.name,
                };
            }
            return {
                role: msg.role,
                content: msg.content,
            };
        });
    }
    async *streamResponse(request) {
        if (!this.client) {
            throw new Error("OpenAI クライアントが初期化されていません。");
        }
        const stream = await this.client.chat.completions.create({
            model: request.model,
            messages: this.toMessages(request.messages),
            tools: request.tools,
            stream: true,
            signal: request.signal,
        });
        const pendingToolCalls = new Map();
        for await (const chunk of stream) {
            for (const choice of chunk.choices ?? []) {
                const delta = choice.delta;
                if (delta?.content) {
                    yield delta.content;
                }
                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        const buffer = pendingToolCalls.get(toolCall.index) ?? { arguments: "" };
                        buffer.id = toolCall.id ?? buffer.id;
                        buffer.name = toolCall.function?.name ?? buffer.name;
                        buffer.arguments += toolCall.function?.arguments ?? "";
                        pendingToolCalls.set(toolCall.index, buffer);
                    }
                }
                if (choice.finish_reason === "tool_calls" && pendingToolCalls.size > 0) {
                    for (const [, pending] of pendingToolCalls) {
                        if (pending.id && pending.name) {
                            const toolCall = {
                                id: pending.id,
                                type: "function",
                                function: { name: pending.name, arguments: pending.arguments },
                            };
                            yield toolCall;
                        }
                    }
                    pendingToolCalls.clear();
                }
            }
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
exports.default = OpenAIProvider;
