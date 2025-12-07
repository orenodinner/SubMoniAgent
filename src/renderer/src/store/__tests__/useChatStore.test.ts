import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "../useChatStore";

const initialSessionId = useChatStore.getState().sessionId;

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      status: "idle",
      currentModel: "gpt-4.1-mini",
      sessionId: initialSessionId,
      mcpStatuses: [],
      errorMessage: undefined,
      availableModels: [],
      modelsError: undefined,
    });
  });

  it("adds a message to the store", () => {
    const now = new Date().toISOString();
    expect(useChatStore.getState().messages).toHaveLength(0);

    useChatStore.getState().addMessage({
      id: "1",
      role: "user",
      content: "Hello",
      timestamp: now,
    });

    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe("Hello");
  });

  it("updates status via setStatus", () => {
    expect(useChatStore.getState().status).toBe("idle");
    useChatStore.getState().setStatus("thinking");
    expect(useChatStore.getState().status).toBe("thinking");
  });

  it("appends and finalizes assistant messages", () => {
    const now = new Date().toISOString();
    const assistantId = "assistant-1";

    useChatStore.getState().addMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: now,
      streaming: true,
    });

    useChatStore.getState().appendAssistantChunk(assistantId, "chunk");
    expect(useChatStore.getState().messages[0].content).toBe("chunk");

    useChatStore.getState().finalizeAssistantMessage(assistantId, "final", "gpt-4.1");
    const message = useChatStore.getState().messages[0];
    expect(message.content).toBe("final");
    expect(message.streaming).toBe(false);
    expect(message.model).toBe("gpt-4.1");
  });
});
