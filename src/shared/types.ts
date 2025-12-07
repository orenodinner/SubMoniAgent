/**
 * MCPサーバーの設定情報
 */
export type McpServer = {
  id: string;
  name: string;
  endpoint: string;
  apiKeyEncrypted?: string;
  enabled: boolean;
};

/**
 * MCPサーバーの接続状態
 */
export type McpStatus = {
  id: string;
  name: string;
  connected: boolean;
};

/**
 * アプリケーション全体の設定オブジェクト
 */
export type AppConfig = {
  version: number;
  llm: {
    provider: string;
    apiKeyEncrypted: string;
    defaultModel: string;
    systemPrompt: string;
  };
  mcp: {
    servers: McpServer[];
  };
  ui: {
    theme: "light" | "dark";
    alwaysOnTop: boolean;
    spriteSheetPath: string;
    animationSpeedScale: number;
    characterPaneWidth: number;
    screenFilter: string;
    avatarFilter: string;
    fontScale: number;
    showCodecLines: boolean;
  };
};

/**
 * IPC通信で使用するチャットメッセージの型
 */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LlmModel = {
  id: string;
  name: string;
  description?: string;
};
