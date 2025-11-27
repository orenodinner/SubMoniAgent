import React, { useEffect, useMemo, useState } from "react";
import HeaderBar from "./components/HeaderBar";
import CharacterCanvas from "./components/CharacterCanvas";
import ChatView from "./components/ChatView";
import SettingsDialog from "./components/SettingsDialog";
import { useChatStore, ChatState, McpStatus } from "./store/useChatStore";

type AppConfig = {
  version: number;
  llm: {
    provider: string;
    apiKeyEncrypted: string;
    defaultModel: string;
    systemPrompt: string;
  };
  mcp: {
    servers: { id: string; name: string; endpoint: string; enabled: boolean }[];
  };
  ui: {
    theme: "light" | "dark";
    alwaysOnTop: boolean;
    spriteSheetPath: string;
    animationSpeedScale: number;
  };
};

function stateLabel(state: ChatState) {
  switch (state) {
    case "thinking":
      return "考え中…";
    case "speaking":
      return "話し中…";
    case "listening":
      return "待機しています";
    case "error":
      return "エラーが発生しました";
    default:
      return "ゆったり待機中";
  }
}

export default function App() {
  const {
    messages,
    status,
    currentModel,
    sendMessage,
    appendAssistantChunk,
    finalizeAssistantMessage,
    setStatus,
    setMcpStatuses,
    mcpStatuses,
    setModel,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!window.api) return;
    window.api.getSettings().then((cfg) => setConfig(cfg));
    window.api.getMcpStatus?.().then((status) => setMcpStatuses(status));
  }, [setMcpStatuses]);

  useEffect(() => {
    if (!window.api) return;

    const offChunk = window.api.onAssistantChunk(({ assistantId, chunk }) => {
      appendAssistantChunk(assistantId, chunk);
    });

    const offMessage = window.api.onAssistantMessage(({ assistantId, content, model }) => {
      finalizeAssistantMessage(assistantId, content, model);
    });

    const offState = window.api.onStateUpdate((state) => setStatus(state as ChatState));

    const offMcp = window.api.onMcpStatusChanged((status: McpStatus[]) => setMcpStatuses(status));

    return () => {
      offChunk?.();
      offMessage?.();
      offState?.();
      offMcp?.();
    };
  }, [appendAssistantChunk, finalizeAssistantMessage, setStatus, setMcpStatuses]);

  const connectedCount = useMemo(
    () => mcpStatuses.filter((s) => s.connected).length,
    [mcpStatuses]
  );
  const totalServers = mcpStatuses.length;

  const handleSend = async () => {
    await sendMessage(input);
    setInput("");
  };

  const handleSaveSettings = async (next: AppConfig) => {
    if (!window.api) return;
    const saved = await window.api.saveSettings(next);
    setConfig(saved);
    setSettingsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-shell">
      <HeaderBar
        modelName={currentModel}
        mcpConnected={connectedCount > 0}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="character-area">
        <div className="canvas-frame">
          <CharacterCanvas state={status} />
        </div>
        <div className="character-state">{stateLabel(status)}</div>
      </div>

      <div className="chat-area">
        <ChatView messages={messages} />
      </div>

      <div className="toolbar">
        <div className="chip">MCP接続: {connectedCount}/{totalServers || 0}</div>
        <div className="chip">システムプロンプト: {config?.llm.systemPrompt ?? "ロード中"}</div>
      </div>

      <div className="input-area">
        <textarea
          className="textbox"
          placeholder="質問を入力… (Enterで送信 / Shift+Enterで改行)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <select className="model-select" value={currentModel} onChange={(e) => setModel(e.target.value)}>
          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          <option value="gpt-4.1">gpt-4.1</option>
          <option value="o1-mini">o1-mini</option>
        </select>
        <button className="send-btn" onClick={handleSend}>
          <span>送信</span> <span>→</span>
        </button>
      </div>

      {settingsOpen && config && (
        <SettingsDialog config={config} onSave={handleSaveSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
