"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const vitest_1 = require("vitest");
vitest_1.vi.mock("electron", () => import("../../../tests/mocks/electron"));
vitest_1.vi.mock("fs", () => {
    const existsSync = vitest_1.vi.fn();
    const mkdirSync = vitest_1.vi.fn();
    const readFileSync = vitest_1.vi.fn();
    const writeFileSync = vitest_1.vi.fn();
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
const configStore_1 = require("../configStore");
const electron_1 = require("../../../tests/mocks/electron");
const fsMock = vitest_1.vi.mocked(fs_1.default);
const baseConfig = {
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
(0, vitest_1.describe)("configStore", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("returns defaults and creates files when config is missing", () => {
        fsMock.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(false);
        const config = (0, configStore_1.loadConfig)();
        (0, vitest_1.expect)(config.llm.provider).toBe("openai");
        (0, vitest_1.expect)(fsMock.mkdirSync).toHaveBeenCalled();
        (0, vitest_1.expect)(fsMock.writeFileSync).toHaveBeenCalled();
    });
    (0, vitest_1.it)("encrypts API keys when saving", () => {
        const configToSave = {
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
        (0, configStore_1.saveConfig)(configToSave);
        const [, payload] = fsMock.writeFileSync.mock.calls[0];
        const saved = JSON.parse(payload);
        (0, vitest_1.expect)(saved.llm.apiKeyEncrypted).toBe(Buffer.from("encrypted_super-secret").toString("hex"));
        (0, vitest_1.expect)(saved.mcp.servers[0].apiKeyEncrypted).toBe(Buffer.from("encrypted_mcp-key").toString("hex"));
        (0, vitest_1.expect)(electron_1.safeStorage.encryptString).toHaveBeenCalledWith("super-secret");
        (0, vitest_1.expect)(electron_1.safeStorage.encryptString).toHaveBeenCalledWith("mcp-key");
    });
    (0, vitest_1.it)("decrypts stored values when loading existing config", () => {
        const encryptedKey = Buffer.from("encrypted_existing").toString("hex");
        const encryptedServerKey = Buffer.from("encrypted_server-key").toString("hex");
        fsMock.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
        fsMock.readFileSync.mockReturnValue(JSON.stringify({
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
        }));
        const config = (0, configStore_1.loadConfig)();
        (0, vitest_1.expect)(config.llm.apiKeyEncrypted).toBe("existing");
        (0, vitest_1.expect)(config.mcp.servers[0].apiKeyEncrypted).toBe("server-key");
        (0, vitest_1.expect)(electron_1.safeStorage.decryptString).toHaveBeenCalled();
    });
});
