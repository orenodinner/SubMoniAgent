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
    return { ...defaultConfig, ...parsed };
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
