import React, { useEffect, useMemo, useRef, useState } from "react";
import CharacterCanvas from "./components/CharacterCanvas";
import ChatView from "./components/ChatView";
import SettingsDialog from "./components/SettingsDialog";
import { useChatStore, ChatState } from "./store/useChatStore";
import type { AppConfig, McpStatus } from "../../shared/types";

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
    availableModels,
    loadModels,
    modelsError,
    handleError,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paneWidth, setPaneWidth] = useState(0.44);
  const [modelQuery, setModelQuery] = useState("");
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
      if (cfg?.llm?.defaultModel) {
        setModel(cfg.llm.defaultModel);
      }
    });
    window.api.getMcpStatus?.().then((status) => setMcpStatuses(status));
    loadModels();
  }, [setMcpStatuses, loadModels, setModel]);

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
    const offError = window.api.onChatError?.((error) => handleError(error));

    return () => {
      offChunk?.();
      offMessage?.();
      offState?.();
      offMcp?.();
      offError?.();
    };
  }, [appendAssistantChunk, finalizeAssistantMessage, setStatus, setMcpStatuses, handleError]);

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
    if (saved.llm.defaultModel) {
      setModel(saved.llm.defaultModel);
    }
    await loadModels();
    setSettingsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modelOptions =
    availableModels.length > 0
      ? availableModels
      : [
          { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
          { id: "gpt-4.1", name: "gpt-4.1" },
          { id: "o1-mini", name: "o1-mini" },
        ];

  const filteredModelOptions = (() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return modelOptions;
    const matched = modelOptions.filter(
      (model) => model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query)
    );
    return matched.length > 0 ? matched : modelOptions;
  })();

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
        <div className="model-search-row">
          <input
            type="text"
            className="model-search"
            placeholder="モデルを検索"
            value={modelQuery}
            onChange={(e) => setModelQuery(e.target.value)}
          />
          <select className="model-select" value={currentModel} onChange={(e) => setModel(e.target.value)}>
            {filteredModelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="textbox"
          placeholder="質問を入力… (Enterで改行 / Ctrl+Enterで送信)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
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
          models={modelOptions}
          modelsError={modelsError}
        />
      )}
    </div>
  );
}
