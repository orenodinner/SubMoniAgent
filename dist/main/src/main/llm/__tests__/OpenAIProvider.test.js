"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const OpenAIProvider_1 = require("../OpenAIProvider");
const createAsyncStream = (chunks) => ({
    async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
            yield chunk;
        }
    },
});
const mockCreate = vitest_1.vi.fn();
const mockModelsList = vitest_1.vi.fn();
vitest_1.vi.mock("openai", () => {
    return {
        __esModule: true,
        default: vitest_1.vi.fn(() => ({
            chat: { completions: { create: mockCreate } },
            models: { list: mockModelsList },
        })),
    };
});
(0, vitest_1.describe)("OpenAIProvider", () => {
    (0, vitest_1.beforeEach)(() => {
        mockCreate.mockReset();
        mockModelsList.mockReset();
    });
    (0, vitest_1.it)("streams text deltas", async () => {
        const provider = new OpenAIProvider_1.OpenAIProvider();
        provider.initialize({ apiKey: "test-key" });
        mockCreate.mockResolvedValueOnce(createAsyncStream([
            { choices: [{ delta: { content: "Hello" } }] },
            { choices: [{ delta: { content: "!" }, finish_reason: "stop" }] },
        ]));
        const messages = [{ role: "user", content: "Hi" }];
        const chunks = [];
        for await (const chunk of provider.streamResponse({ model: "gpt-4.1-mini", messages })) {
            if (typeof chunk === "string") {
                chunks.push(chunk);
            }
        }
        (0, vitest_1.expect)(mockCreate).toHaveBeenCalledWith({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: "Hi" }],
            tools: undefined,
            stream: true,
            signal: undefined,
        });
        (0, vitest_1.expect)(chunks.join("")).toBe("Hello!");
    });
    (0, vitest_1.it)("assembles tool calls before yielding", async () => {
        const provider = new OpenAIProvider_1.OpenAIProvider();
        provider.initialize({ apiKey: "test-key" });
        mockCreate.mockResolvedValueOnce(createAsyncStream([
            {
                choices: [
                    {
                        delta: {
                            tool_calls: [
                                { index: 0, id: "call_1", function: { name: "weather", arguments: '{"city": "Tokyo"' } },
                            ],
                        },
                    },
                ],
            },
            {
                choices: [
                    {
                        delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] },
                        finish_reason: "tool_calls",
                    },
                ],
            },
        ]));
        const messages = [{ role: "user", content: "What's the weather?" }];
        const toolCalls = [];
        for await (const chunk of provider.streamResponse({ model: "gpt-4.1-mini", messages })) {
            if (typeof chunk !== "string") {
                toolCalls.push(chunk);
            }
        }
        (0, vitest_1.expect)(toolCalls).toEqual([
            {
                id: "call_1",
                type: "function",
                function: { name: "weather", arguments: '{"city": "Tokyo"}' },
            },
        ]);
    });
    (0, vitest_1.it)("checks connection via models.list", async () => {
        const provider = new OpenAIProvider_1.OpenAIProvider();
        provider.initialize({ apiKey: "test-key" });
        mockModelsList.mockResolvedValueOnce({});
        const result = await provider.checkConnection();
        (0, vitest_1.expect)(result).toBe(true);
        (0, vitest_1.expect)(mockModelsList).toHaveBeenCalled();
    });
});
