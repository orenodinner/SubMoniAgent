import { create } from "zustand";
import { nanoid } from "nanoid";
import type { McpStatus } from "../../../shared/types";

export type ChatState = "idle" | "listening" | "thinking" | "speaking" | "error";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  model?: string;
  streaming?: boolean;
};

type Store = {
  messages: Message[];
  status: ChatState;
  currentModel: string;
  sessionId: string;
  mcpStatuses: McpStatus[];
  setStatus: (status: ChatState) => void;
  addMessage: (message: Message) => void;
  appendAssistantChunk: (assistantId: string, chunk: string) => void;
  finalizeAssistantMessage: (assistantId: string, content: string, model?: string) => void;
  setMcpStatuses: (statuses: McpStatus[]) => void;
  setModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
};

export const useChatStore = create<Store>((set, get) => ({
  messages: [],
  status: "idle",
  currentModel: "gpt-4.1-mini",
  sessionId: nanoid(),
  mcpStatuses: [],
  setStatus: (status) => set({ status }),
  setModel: (model) => set({ currentModel: model }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendAssistantChunk: (assistantId, chunk) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === assistantId ? { ...msg, content: `${msg.content}${chunk}` } : msg
      ),
    })),
  finalizeAssistantMessage: (assistantId, content, model) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === assistantId ? { ...msg, content, streaming: false, model } : msg
      ),
    })),
  setMcpStatuses: (statuses) => set({ mcpStatuses: statuses }),
  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !window.api) return;
    const now = new Date().toISOString();
    const assistantId = `assistant-${Date.now()}`;
    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: trimmed, timestamp: now };
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: now,
      model: get().currentModel,
      streaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      status: "thinking",
    }));

    const result = await window.api.sendMessage({
      text: trimmed,
      model: get().currentModel,
      assistantId,
      sessionId: get().sessionId,
    });

    if (result?.error) {
      set({ status: "error" });
    }
  },
}));