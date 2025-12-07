import React, { useEffect, useMemo, useRef, useState } from "react";
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
    characterPaneWidth: number;
    screenFilter: string;
    avatarFilter: string;
    fontScale: number;
    showCodecLines: boolean;
  };
};

function formatStatus(state: ChatState) {
  switch (state) {
    case "thinking":
      return "考え中";
    case "speaking":
      return "話し中";
    case "listening":
      return "待機";
    case "error":
      return "エラー";
    default:
      return "待機";
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
  const [paneWidth, setPaneWidth] = useState(0.44);
  const paneWidthRef = useRef(paneWidth);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    paneWidthRef.current = paneWidth;
  }, [paneWidth]);

  const cssVars = useMemo(
    () =>
      ({
        "--screen-filter": config?.ui.screenFilter,
        "--avatar-filter": config?.ui.avatarFilter,
        "--character-column": `${(paneWidth * 100).toFixed(2)}%`,
        "--font-scale": config?.ui.fontScale ?? 1,
      } as React.CSSProperties),
    [config, paneWidth]
  );

  useEffect(() => {
    if (!window.api) return;
    window.api.getSettings().then((cfg) => {
      setConfig(cfg);
      setPaneWidth(cfg?.ui?.characterPaneWidth ?? 0.44);
    });
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

  const clampWidth = (value: number) => Math.min(0.9, Math.max(0.05, value));

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (event: MouseEvent) => {
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const ratio = clampWidth((event.clientX - bounds.left) / bounds.width);
      paneWidthRef.current = ratio;
      setPaneWidth(ratio);
    };

    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setConfig((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ui: { ...prev.ui, characterPaneWidth: paneWidthRef.current } };
        window.api?.saveSettings?.(next);
        return next;
      });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleSend = async () => {
    await sendMessage(input);
    setInput("");
  };

  const handleSaveSettings = async (next: AppConfig) => {
    if (!window.api) return;
    const saved = await window.api.saveSettings(next);
    setConfig(saved);
    setPaneWidth(saved.ui.characterPaneWidth ?? paneWidth);
    setSettingsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-shell" style={cssVars} ref={shellRef}>
      <div className="character-area">
        <div className="canvas-frame">
          <CharacterCanvas state={status} enableCodecLines={config?.ui.showCodecLines !== false} />
        </div>
        <div className="character-meta">
          <div className="meta-chip">MCP接続: {connectedCount}/{totalServers || 0}</div>
          <div className="meta-chip">ステータス: {formatStatus(status)}</div>
        </div>
      </div>

      <div className="column-resizer" onMouseDown={startResize} title="ドラッグで幅を変更" />

      <div className="chat-area">
        <div className="chat-top-bar">
          <div className="model-tag-inline">{currentModel}</div>
          <button className="button-icon" onClick={() => setSettingsOpen(true)} title="設定">
            ⚙
          </button>
        </div>
        <ChatView messages={messages} />
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
        <SettingsDialog
          config={config}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
          connectionInfo={{ connectedCount, totalServers }}
        />
      )}
    </div>
  );
}
