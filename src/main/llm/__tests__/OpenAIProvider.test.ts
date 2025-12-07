import { describe, expect, it, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../OpenAIProvider";
import type { ChatMessage } from "../types";

const createAsyncStream = (chunks: unknown[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) {
      yield chunk;
    }
  },
});

const mockCreate = vi.fn();
const mockModelsList = vi.fn();

vi.mock("openai", () => {
  return {
    __esModule: true,
    default: vi.fn(() => ({
      chat: { completions: { create: mockCreate } },
      models: { list: mockModelsList },
    })),
  };
});

describe("OpenAIProvider", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockModelsList.mockReset();
  });

  it("streams text deltas", async () => {
    const provider = new OpenAIProvider();
    provider.initialize({ apiKey: "test-key" });

    mockCreate.mockResolvedValueOnce(
      createAsyncStream([
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: "!" }, finish_reason: "stop" }] },
      ])
    );

    const messages: ChatMessage[] = [{ role: "user", content: "Hi" }];
    const chunks: string[] = [];

    for await (const chunk of provider.streamResponse({ model: "gpt-4.1-mini", messages })) {
      if (typeof chunk === "string") {
        chunks.push(chunk);
      }
    }

    expect(mockCreate).toHaveBeenCalledWith({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "Hi" }],
      tools: undefined,
      stream: true,
      signal: undefined,
    });
    expect(chunks.join("")).toBe("Hello!");
  });

  it("assembles tool calls before yielding", async () => {
    const provider = new OpenAIProvider();
    provider.initialize({ apiKey: "test-key" });

    mockCreate.mockResolvedValueOnce(
      createAsyncStream([
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
      ])
    );

    const messages: ChatMessage[] = [{ role: "user", content: "What's the weather?" }];
    const toolCalls: unknown[] = [];

    for await (const chunk of provider.streamResponse({ model: "gpt-4.1-mini", messages })) {
      if (typeof chunk !== "string") {
        toolCalls.push(chunk);
      }
    }

    expect(toolCalls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "weather", arguments: '{"city": "Tokyo"}' },
      },
    ]);
  });

  it("checks connection via models.list", async () => {
    const provider = new OpenAIProvider();
    provider.initialize({ apiKey: "test-key" });
    mockModelsList.mockResolvedValueOnce({});

    const result = await provider.checkConnection();
    expect(result).toBe(true);
    expect(mockModelsList).toHaveBeenCalled();
  });
});
