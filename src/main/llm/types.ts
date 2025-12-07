export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage =
  | {
      role: Exclude<ChatRole, "tool">;
      content: string;
    }
  | {
      role: "tool";
      content: string;
      tool_call_id: string;
      name?: string;
    };

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type LLMProviderInitOptions = {
  apiKey: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
};

export interface LLMRequest {
  messages: ChatMessage[];
  model: string;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

export interface LLMProvider {
  initialize(options: LLMProviderInitOptions): void;
  streamResponse(request: LLMRequest): AsyncGenerator<string | ToolCall>;
  checkConnection(): Promise<boolean>;
}
