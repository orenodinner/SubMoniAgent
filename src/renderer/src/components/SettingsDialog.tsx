import React, { useEffect, useState } from "react";
import type { AppConfig, LlmModel } from "../../../shared/types";

export type SettingsDialogProps = {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
  connectionInfo: { connectedCount: number; totalServers: number };
  models: LlmModel[];
  modelsError?: string;
};

export default function SettingsDialog({
  config,
  onSave,
  onClose,
  connectionInfo,
  models,
  modelsError,
}: SettingsDialogProps) {
  const [local, setLocal] = useState<AppConfig>(config);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [modelQuery, setModelQuery] = useState("");

  useEffect(() => setLocal(config), [config]);

  const handleOpenRouterOAuth = async () => {
    if (!window.api?.startOpenRouterOAuth) {
      setOauthError("このビルドではOAuthが有効化されていません。");
      return;
    }

    setOauthLoading(true);
    setOauthError(null);

    try {
      const result = await window.api.startOpenRouterOAuth();
      if (result?.error) {
        setOauthError(result.error);
        return;
      }
      if (result?.key) {
        setLocal((prev) => ({
          ...prev,
          llm: { ...prev.llm, apiKeyEncrypted: result.key, provider: "openrouter" },
        }));
      }
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-card">
        <h2>設定</h2>
        <div className="settings-info">
          <div>? MCP接続: {connectionInfo.connectedCount}/{connectionInfo.totalServers || 0}</div>
          <div>? システムプロンプト: {local.llm.systemPrompt || "未設定"}</div>
        </div>

        <label>
          LLMプロバイダー
          <select
            value={local.llm.provider}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, provider: e.target.value } })}
          >
            <option value="openai">OpenAI (互換API)</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </label>

        <label>
          デフォルトモデル
          <div className="model-search-row">
            <input
              type="text"
              className="model-search"
              placeholder="モデルを検索"
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
            />
          </div>
          <select
            value={local.llm.defaultModel}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, defaultModel: e.target.value } })}
          >
            {(modelQuery
              ? models.filter(
                  (m) =>
                    m.id.toLowerCase().includes(modelQuery.toLowerCase()) ||
                    m.name.toLowerCase().includes(modelQuery.toLowerCase())
                )
              : models
            ).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          {modelsError && <div className="oauth-error">モデル取得エラー: {modelsError}</div>}
          {!models.length && <div className="oauth-hint">モデル一覧が取得できませんでした。APIキーとプロバイダーを確認してください。</div>}
        </label>

        <label>
          APIキー（ローカル保存）
          <input
            type="password"
            value={local.llm.apiKeyEncrypted}
            onChange={(e) => setLocal({ ...local, llm: { ...local.llm, apiKeyEncrypted: e.target.value } })}
          />
        </label>
        <div className="oauth-row">
          <button className="small-btn primary" onClick={handleOpenRouterOAuth} disabled={oauthLoading}>
            {oauthLoading ? "連携中..." : "OpenRouterでOAuthログイン"}
          </button>
          <div className="oauth-hint">
            OpenRouterでログインしてAPIキーを取得し、自動入力します。保存すると反映されます（現在: {local.llm.provider || "openai"}）。
          </div>
        </div>
        {oauthError && <div className="oauth-error">{oauthError}</div>}

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
          画面フィルター（CSS filter 文字列）
          <input
            type="text"
            value={local.ui.screenFilter}
            placeholder="brightness(0.55) contrast(1.05)"
            onChange={(e) => setLocal({ ...local, ui: { ...local.ui, screenFilter: e.target.value } })}
          />
        </label>
        <label>
          アバターフィルター（黒→緑など色味調整）
          <input
            type="text"
            value={local.ui.avatarFilter}
            placeholder="brightness(0.9) contrast(1.1) sepia(0.9) hue-rotate(90deg) saturate(3)"
            onChange={(e) => setLocal({ ...local, ui: { ...local.ui, avatarFilter: e.target.value } })}
          />
        </label>

        <label>
          表示文字サイズ
          <div className="slider-row">
            <input
              type="range"
              min="0.8"
              max="3"
              step="0.05"
              value={local.ui.fontScale}
              onChange={(e) =>
                setLocal({ ...local, ui: { ...local.ui, fontScale: parseFloat(e.target.value) || 1 } })
              }
            />
            <span className="slider-value">{Math.round((local.ui.fontScale || 1) * 100)}%</span>
          </div>
        </label>

        <label>
          オシロスコープラインを表示
          <input
            type="checkbox"
            checked={local.ui.showCodecLines ?? true}
            onChange={(e) => setLocal({ ...local, ui: { ...local.ui, showCodecLines: e.target.checked } })}
          />
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
