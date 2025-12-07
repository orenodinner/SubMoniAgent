import fs from "fs";
import path from "path";
import { app, safeStorage } from "electron";
import { AppConfig } from "../shared/types";

const defaultConfig: AppConfig = {
  version: 1,
  llm: {
    provider: "openai",
    apiKeyEncrypted: "",
    defaultModel: "gpt-4.1-mini",
    systemPrompt: "You are PixelAgent, a helpful desktop agent represented by a pixel art character.",
  },
  mcp: {
    servers: [
      {
        id: "todo-server",
        name: "Todo Server",
        endpoint: "wss://example.com/mcp",
        apiKeyEncrypted: "",
        enabled: false,
      },
    ],
  },
  ui: {
    theme: "dark",
    alwaysOnTop: false,
    spriteSheetPath: "assets/pixel-sprite.png",
    animationSpeedScale: 1,
    characterPaneWidth: 0.44,
    screenFilter: "brightness(0.55) contrast(1.05)",
    avatarFilter: "brightness(0.9) contrast(1.1) sepia(0.9) hue-rotate(90deg) saturate(3)",
    fontScale: 1,
    showCodecLines: true,
  },
};

function getConfigDir() {
  return path.join(app.getPath("appData"), "PixelAgent");
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

/**
 * 文字列を暗号化するヘルパー関数
 * safeStorageが利用可能な場合は暗号化してHex文字列を返す
 * 利用不可の場合は平文を返す
 */
function encryptField(text: string): string {
  if (!text) return "";
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.encryptString(text).toString("hex");
    } catch (err) {
      console.error("Encryption failed:", err);
      return text;
    }
  }
  return text;
}

/**
 * 文字列を復号するヘルパー関数
 * Hex文字列から復号を試みる。失敗した場合やsafeStorageがない場合はそのまま返す
 */
function decryptField(text: string): string {
  if (!text) return "";
  if (safeStorage.isEncryptionAvailable()) {
    try {
      // Hex文字列とみなしてBuffer化
      const buffer = Buffer.from(text, "hex");
      return safeStorage.decryptString(buffer);
    } catch {
      // 復号失敗時（平文データの可能性など）はそのまま返す
      return text;
    }
  }
  return text;
}

export function loadConfig(): AppConfig {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    // 新規作成時はデフォルトを保存（暗号化は不要、空文字なので）
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as AppConfig;

    // 復号処理
    const decryptedConfig: AppConfig = {
      ...defaultConfig,
      ...parsed,
      llm: {
        ...defaultConfig.llm,
        ...parsed.llm,
        // APIキーを復号
        apiKeyEncrypted: decryptField(parsed.llm?.apiKeyEncrypted || ""),
      },
      mcp: {
        ...defaultConfig.mcp,
        ...parsed.mcp,
        // MCPサーバーごとのAPIキーを復号
        servers: (parsed.mcp?.servers || []).map((server) => ({
          ...server,
          apiKeyEncrypted: decryptField(server.apiKeyEncrypted || ""),
        })),
      },
      ui: { ...defaultConfig.ui, ...parsed.ui },
    };

    return decryptedConfig;
  } catch (err) {
    console.error("Failed to read config, using defaults", err);
    return defaultConfig;
  }
}

export function saveConfig(config: AppConfig) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 保存用にデータを暗号化する（メモリ上のconfigは変更しないようクローン）
  const configToSave = {
    ...config,
    llm: {
      ...config.llm,
      // APIキーを暗号化
      apiKeyEncrypted: encryptField(config.llm.apiKeyEncrypted),
    },
    mcp: {
      ...config.mcp,
      // MCPサーバーごとのAPIキーを暗号化
      servers: config.mcp.servers.map((server) => ({
        ...server,
        apiKeyEncrypted: encryptField(server.apiKeyEncrypted || ""),
      })),
    },
  };

  fs.writeFileSync(getConfigPath(), JSON.stringify(configToSave, null, 2), "utf8");
}