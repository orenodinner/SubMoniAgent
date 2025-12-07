import { create } from "zustand";
import { nanoid } from "nanoid";
import type { LlmModel, McpStatus } from "../../../shared/types";
import { logger } from "../utils/logger";

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
  errorMessage?: string;
  availableModels: LlmModel[];
  modelsError?: string;
  setStatus: (status: ChatState) => void;
  addMessage: (message: Message) => void;
  appendAssistantChunk: (assistantId: string, chunk: string) => void;
  finalizeAssistantMessage: (assistantId: string, content: string, model?: string) => void;
  handleError: (payload: { assistantId?: string; message: string; code?: string }) => void;
  setMcpStatuses: (statuses: McpStatus[]) => void;
  setModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
  abortMessage: (assistantId: string) => Promise<void>;
  setAvailableModels: (models: LlmModel[]) => void;
  loadModels: () => Promise<void>;
};

export const useChatStore = create<Store>((set, get) => ({
  messages: [],
  status: "idle",
  currentModel: "gpt-4.1-mini",
  sessionId: nanoid(),
  mcpStatuses: [],
  errorMessage: undefined,
  availableModels: [],
  modelsError: undefined,
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
  handleError: ({ assistantId, message, code }) =>
    set((state) => {
      const now = new Date().toISOString();
      let updated = false;
      logger.error("Chat error handled", { assistantId, code, message });
      const messages = state.messages.map((msg) => {
        if (assistantId && msg.id === assistantId) {
          updated = true;
          return { ...msg, content: `エラー: ${message}`, streaming: false };
        }
        return msg;
      });

      if (!updated) {
        messages.push({
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `エラー: ${message}`,
          timestamp: now,
        });
      }

      return {
        messages,
        status: code === "aborted" ? "idle" : "error",
        errorMessage: message,
      };
    }),
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

    logger.info("Sending chat message", { assistantId, model: get().currentModel, sessionId: get().sessionId });
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
      logger.error("sendMessage returned error", { assistantId, message: result.error });
      get().handleError({ assistantId, message: result.error });
    }
  },
  abortMessage: async (assistantId: string) => {
    if (!window.api?.abortMessage) return;
    logger.info("Abort requested", { assistantId });
    await window.api.abortMessage(assistantId);
  },
  setAvailableModels: (models: LlmModel[]) => set({ availableModels: models }),
  loadModels: async () => {
    if (!window.api?.listModels) return;
    logger.info("Loading model list from main process");
    const result = await window.api.listModels();
    const models = result?.models ?? [];
    set({
      availableModels: models,
      modelsError: result?.error,
    });
    if (result?.error) {
      logger.error("Failed to load models", { error: result.error });
    }

    if (models.length > 0 && !models.some((m) => m.id === get().currentModel)) {
      set({ currentModel: models[0].id });
    }
  },
}));
