import fs from "fs";
import path from "path";
import { app } from "electron";
import { McpServer } from "./mcpClient";

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

export function loadConfig(): AppConfig {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as AppConfig;
    return {
      ...defaultConfig,
      ...parsed,
      llm: { ...defaultConfig.llm, ...parsed.llm },
      mcp: { ...defaultConfig.mcp, ...parsed.mcp },
      ui: { ...defaultConfig.ui, ...parsed.ui },
    };
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
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
}
