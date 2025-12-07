"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const defaultConfig = {
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
    return path_1.default.join(electron_1.app.getPath("appData"), "PixelAgent");
}
function getConfigPath() {
    return path_1.default.join(getConfigDir(), "config.json");
}
/**
 * 文字列を暗号化するヘルパー関数
 * safeStorageが利用可能な場合は暗号化してHex文字列を返す
 * 利用不可の場合は平文を返す
 */
function encryptField(text) {
    if (!text)
        return "";
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        try {
            return electron_1.safeStorage.encryptString(text).toString("hex");
        }
        catch (err) {
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
function decryptField(text) {
    if (!text)
        return "";
    if (electron_1.safeStorage.isEncryptionAvailable()) {
        try {
            // Hex文字列とみなしてBuffer化
            const buffer = Buffer.from(text, "hex");
            return electron_1.safeStorage.decryptString(buffer);
        }
        catch {
            // 復号失敗時（平文データの可能性など）はそのまま返す
            return text;
        }
    }
    return text;
}
function loadConfig() {
    const dir = getConfigDir();
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    const configPath = getConfigPath();
    if (!fs_1.default.existsSync(configPath)) {
        // 新規作成時はデフォルトを保存（暗号化は不要、空文字なので）
        fs_1.default.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
        return defaultConfig;
    }
    try {
        const raw = fs_1.default.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw);
        // 復号処理
        const decryptedConfig = {
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
    }
    catch (err) {
        console.error("Failed to read config, using defaults", err);
        return defaultConfig;
    }
}
function saveConfig(config) {
    const dir = getConfigDir();
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
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
    fs_1.default.writeFileSync(getConfigPath(), JSON.stringify(configToSave, null, 2), "utf8");
}
