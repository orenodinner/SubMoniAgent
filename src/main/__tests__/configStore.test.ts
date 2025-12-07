import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => import("../../../tests/mocks/electron"));
vi.mock("fs", () => {
  const existsSync = vi.fn();
  const mkdirSync = vi.fn();
  const readFileSync = vi.fn();
  const writeFileSync = vi.fn();

  return {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    default: {
      existsSync,
      mkdirSync,
      readFileSync,
      writeFileSync,
    },
  };
});

import { loadConfig, saveConfig } from "../configStore";
import type { AppConfig } from "../../shared/types";
import { safeStorage } from "../../../tests/mocks/electron";

const fsMock = vi.mocked(fs);

const baseConfig: AppConfig = {
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

describe("configStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults and creates files when config is missing", () => {
    fsMock.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(false);

    const config = loadConfig();

    expect(config.llm.provider).toBe("openai");
    expect(fsMock.mkdirSync).toHaveBeenCalled();
    expect(fsMock.writeFileSync).toHaveBeenCalled();
  });

  it("encrypts API keys when saving", () => {
    const configToSave: AppConfig = {
      ...baseConfig,
      llm: { ...baseConfig.llm, apiKeyEncrypted: "super-secret" },
      mcp: {
        servers: [
          {
            id: "mcp-1",
            name: "Example",
            endpoint: "wss://example.com",
            apiKeyEncrypted: "mcp-key",
            enabled: true,
          },
        ],
      },
    };

    fsMock.existsSync.mockReturnValue(true);

    saveConfig(configToSave);

    const [, payload] = fsMock.writeFileSync.mock.calls[0] as [string, string];
    const saved = JSON.parse(payload);

    expect(saved.llm.apiKeyEncrypted).toBe(Buffer.from("encrypted_super-secret").toString("hex"));
    expect(saved.mcp.servers[0].apiKeyEncrypted).toBe(Buffer.from("encrypted_mcp-key").toString("hex"));
    expect(safeStorage.encryptString).toHaveBeenCalledWith("super-secret");
    expect(safeStorage.encryptString).toHaveBeenCalledWith("mcp-key");
  });

  it("decrypts stored values when loading existing config", () => {
    const encryptedKey = Buffer.from("encrypted_existing").toString("hex");
    const encryptedServerKey = Buffer.from("encrypted_server-key").toString("hex");

    fsMock.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        ...baseConfig,
        llm: { ...baseConfig.llm, apiKeyEncrypted: encryptedKey },
        mcp: {
          servers: [
            {
              id: "mcp-1",
              name: "Example",
              endpoint: "wss://example.com",
              apiKeyEncrypted: encryptedServerKey,
              enabled: true,
            },
          ],
        },
      })
    );

    const config = loadConfig();

    expect(config.llm.apiKeyEncrypted).toBe("existing");
    expect(config.mcp.servers[0].apiKeyEncrypted).toBe("server-key");
    expect(safeStorage.decryptString).toHaveBeenCalled();
  });
});
