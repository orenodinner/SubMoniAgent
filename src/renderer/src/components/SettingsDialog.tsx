import React, { useEffect, useState } from "react";

export type SettingsDialogProps = {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
};

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

export default function SettingsDialog({ config, onSave, onClose }: SettingsDialogProps) {
  const [local, setLocal] = useState<AppConfig>(config);

  useEffect(() => setLocal(config), [config]);

  return (
    <div className="settings-overlay">
      <div className="settings-card">
        <h2>設定</h2>

        <label>
          デフォルトモデル
          <select
            value={local.llm.defaultModel}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, defaultModel: e.target.value } })}
          >
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            <option value="gpt-4.1">gpt-4.1</option>
            <option value="o1-mini">o1-mini</option>
          </select>
        </label>

        <label>
          APIキー（ローカル保存）
          <input
            type="password"
            value={local.llm.apiKeyEncrypted}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, apiKeyEncrypted: e.target.value } })}
          />
        </label>

        <label>
          システムプロンプト
          <textarea
            rows={3}
            value={local.llm.systemPrompt}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, systemPrompt: e.target.value } })}
          />
        </label>

        <label>
          テーマ
          <select
            value={local.ui.theme}
            onChange={(e) => setLocal({ ...local, ui: { ...local.ui, theme: e.target.value as "light" | "dark" } })}
          >
            <option value="dark">ダーク</option>
            <option value="light">ライト</option>
          </select>
        </label>

        <label>
          常に手前に表示
          <input
            type="checkbox"
            checked={local.ui.alwaysOnTop}
            onChange={(e) => setLocal({ ...local, ui: { ...local.ui, alwaysOnTop: e.target.checked } })}
          />
        </label>

        <div className="settings-actions">
          <button className="small-btn" onClick={onClose}>
            キャンセル
          </button>
          <button className="small-btn primary" onClick={() => onSave(local)}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
