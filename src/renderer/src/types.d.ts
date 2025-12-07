import type { AppConfig, McpServer, McpStatus } from "../../shared/types";

declare global {
  interface Window {
    api?: {
      sendMessage: (payload: {
        text: string;
        model: string;
        assistantId: string;
        sessionId?: string;
      }) => Promise<{ content?: string; error?: string }>;
      
      getSettings: () => Promise<AppConfig>;
      
      saveSettings: (config: AppConfig) => Promise<AppConfig>;
      
      listMcpServers: () => Promise<McpServer[]>;
      
      getMcpStatus: () => Promise<McpStatus[]>;
      
      startOpenRouterOAuth: () => Promise<{ key?: string; error?: string }>;
      
      onAssistantChunk: (
        callback: (data: { assistantId: string; chunk: string }) => void
      ) => () => void;
      
      onAssistantMessage: (
        callback: (data: { assistantId: string; content: string; model: string }) => void
      ) => () => void;
      
      onStateUpdate: (callback: (state: string) => void) => () => void;
      
      onMcpStatusChanged: (callback: (status: McpStatus[]) => void) => () => void;
    };
  }
}

export {};