import React from "react";

type Props = {
  modelName: string;
  mcpConnected: boolean;
  onOpenSettings: () => void;
};

export default function HeaderBar({ modelName, mcpConnected, onOpenSettings }: Props) {
  return (
    <header className="header">
      <div className="brand">PixelAgent</div>
      <div className="model-tag">{modelName}</div>
      <div className="header-actions">
        <div className={`status-dot ${mcpConnected ? "connected" : ""}`} title={mcpConnected ? "MCP接続中" : "未接続"} />
        <button className="button-icon" onClick={onOpenSettings} title="設定">
          ⚙
        </button>
        <button className="button-icon" onClick={() => window.close()} title="閉じる">
          ×
        </button>
      </div>
    </header>
  );
}
