declare global {
  interface Window {
    api?: {
      sendMessage: (payload: { text: string; model: string; assistantId: string; sessionId?: string }) => Promise<{ content?: string; error?: string }>;
      getSettings: () => Promise<any>;
      saveSettings: (config: any) => Promise<any>;
      listMcpServers: () => Promise<any>;
      getMcpStatus: () => Promise<any>;
      startOpenRouterOAuth: () => Promise<{ key?: string; error?: string }>;
      onAssistantChunk: (callback: (data: { assistantId: string; chunk: string }) => void) => () => void;
      onAssistantMessage: (callback: (data: { assistantId: string; content: string; model: string }) => void) => () => void;
      onStateUpdate: (callback: (state: string) => void) => () => void;
      onMcpStatusChanged: (callback: (status: any) => void) => () => void;
    };
  }
}

export {};
