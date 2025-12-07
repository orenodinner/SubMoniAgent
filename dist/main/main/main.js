"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const electron_updater_1 = require("electron-updater");
const configStore_1 = require("./configStore");
const llmService_1 = require("./llmService");
const logger_1 = __importDefault(require("./logger"));
const mcpClient_1 = require("./mcpClient");
const schemas_1 = require("../shared/schemas");
let mainWindow = null;
let config;
const abortControllers = new Map();
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const isDev = !electron_1.app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_CALLBACK_URL = "http://localhost:3000/";
const CONTENT_SECURITY_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  connect-src 'self' https://openrouter.ai https://api.openai.com wss://* ws://*;
`;
function setupDevTools() {
    if (!isDev)
        return;
    import("electron-debug")
        .then(({ default: debug }) => {
        debug({ showDevTools: false });
    })
        .catch((error) => {
        logger_1.default.warn("Failed to load electron-debug", error);
    });
}
async function setupUnhandled() {
    try {
        const [{ default: unhandled }, electronUtil, electronUtilMain] = await Promise.all([
            import("electron-unhandled"),
            import("electron-util"),
            import("electron-util/main"),
        ]);
        unhandled({
            logger: (error) => logger_1.default.error("Unhandled error", error),
            showDialog: true,
            reportButton: (error) => electronUtil.openNewGitHubIssue({
                user: "pixelagent",
                repo: "pixelagent",
                body: `\`\`\`\n${error.stack ?? error}\n\`\`\`\n\n---\n${electronUtilMain.debugInfo()}`,
            }),
        });
    }
    catch (error) {
        logger_1.default.error("Failed to initialize unhandled error reporting", error);
    }
}
setupDevTools();
void setupUnhandled();
function createWindow() {
    logger_1.default.info("Creating main window");
    mainWindow = new electron_1.BrowserWindow({
        width: 1920,
        height: 480,
        minWidth: 960,
        minHeight: 400,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: "PixelAgent",
    });
    if (VITE_DEV_SERVER_URL) {
        logger_1.default.info(`Loading renderer from dev server at ${VITE_DEV_SERVER_URL}`);
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
    }
    else {
        const indexPath = path_1.default.join(__dirname, "../renderer/index.html");
        logger_1.default.info(`Loading renderer from file://${indexPath}`);
        mainWindow.loadFile(indexPath);
    }
    mainWindow.webContents.setWindowOpenHandler((details) => {
        const targetUrl = details.url;
        if (targetUrl.startsWith("https://") || targetUrl.startsWith("http://")) {
            electron_1.shell.openExternal(targetUrl);
        }
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
        const isDevServer = VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL);
        const isLocalFile = url.startsWith("file://");
        if (!isDevServer && !isLocalFile) {
            event.preventDefault();
        }
    });
    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow?.webContents.send("mcp:statusChanged", mcpClient_1.mcpClient.getStatuses());
        mainWindow?.webContents.send("chat:stateUpdate", "idle");
        logger_1.default.info("Renderer loaded");
    });
}
function startAutoUpdate() {
    electron_updater_1.autoUpdater.logger = logger_1.default;
    electron_updater_1.autoUpdater.on("update-available", () => {
        logger_1.default.info("Update available. Downloading in background.");
    });
    electron_updater_1.autoUpdater.on("update-not-available", () => {
        logger_1.default.info("No updates available");
    });
    electron_updater_1.autoUpdater.on("update-downloaded", (info) => {
        logger_1.default.info("Update downloaded; ready to install on quit", { version: info?.version });
    });
    electron_updater_1.autoUpdater.on("error", (error) => {
        logger_1.default.error("Auto updater error", error);
    });
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        logger_1.default.error("Failed to check for updates", error);
    });
}
function createCodeVerifier() {
    return crypto_1.default.randomBytes(32).toString("hex");
}
function createCodeChallenge(verifier) {
    return crypto_1.default.createHash("sha256").update(verifier).digest().toString("base64url");
}
async function openOpenRouterAuthWindow(codeChallenge) {
    const callbackUrl = OPENROUTER_CALLBACK_URL;
    const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
    return new Promise((resolve, reject) => {
        const authWindow = new electron_1.BrowserWindow({
            width: 520,
            height: 720,
            parent: mainWindow ?? undefined,
            modal: !!mainWindow,
            autoHideMenuBar: true,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        let finished = false;
        const cleanup = () => {
            authWindow.webContents.removeAllListeners("will-redirect");
            authWindow.webContents.removeAllListeners("will-navigate");
            authWindow.removeAllListeners("closed");
        };
        const handleNavigation = (targetUrl) => {
            if (finished)
                return;
            if (targetUrl.startsWith(callbackUrl)) {
                finished = true;
                const url = new URL(targetUrl);
                const code = url.searchParams.get("code");
                cleanup();
                authWindow.close();
                if (code) {
                    resolve(code);
                }
                else {
                    reject(new Error("OpenRouter から code が返されませんでした"));
                }
            }
        };
        authWindow.webContents.on("will-redirect", (_event, targetUrl) => handleNavigation(targetUrl));
        authWindow.webContents.on("will-navigate", (_event, targetUrl) => handleNavigation(targetUrl));
        authWindow.on("closed", () => {
            if (!finished) {
                finished = true;
                cleanup();
                reject(new Error("OAuth ウィンドウが閉じられました"));
            }
        });
        authWindow.loadURL(authUrl);
    });
}
async function exchangeCodeForKey(code, codeVerifier) {
    const response = await fetch(OPENROUTER_KEY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            code_challenge_method: "S256",
        }),
    });
    const bodyText = await response.text();
    const payload = (() => {
        try {
            return JSON.parse(bodyText);
        }
        catch {
            return {};
        }
    })();
    if (!response.ok) {
        const errorMessage = payload?.error || bodyText || response.statusText;
        throw new Error(`OpenRouter API キーの交換に失敗しました (${response.status}): ${errorMessage}`);
    }
    if (!payload?.key) {
        throw new Error("OpenRouter から API キーが返されませんでした");
    }
    return payload.key;
}
async function runOpenRouterOAuth() {
    logger_1.default.info("Starting OpenRouter OAuth flow");
    const codeVerifier = createCodeVerifier();
    const codeChallenge = createCodeChallenge(codeVerifier);
    const code = await openOpenRouterAuthWindow(codeChallenge);
    const key = await exchangeCodeForKey(code, codeVerifier);
    logger_1.default.info("OpenRouter OAuth flow completed");
    return { key, provider: "openrouter" };
}
function getBaseUrlForProvider(provider) {
    if (provider === "openrouter") {
        return OPENROUTER_API_BASE;
    }
    return undefined;
}
async function fetchOpenRouterModels(apiKey) {
    if (!apiKey) {
        return { models: [], error: "APIキーが設定されていません。" };
    }
    try {
        logger_1.default.info("Fetching OpenRouter models list");
        const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        const bodyText = await response.text();
        const payload = (() => {
            try {
                return JSON.parse(bodyText);
            }
            catch {
                return {};
            }
        })();
        if (!response.ok) {
            const message = payload?.error || bodyText || response.statusText;
            return { models: [], error: message };
        }
        const models = payload?.data?.map((model) => ({
            id: model.id,
            name: model.name || model.id,
            description: model.description,
        })) ?? [];
        return { models };
    }
    catch (err) {
        logger_1.default.error("Failed to fetch OpenRouter models", err);
        const message = err instanceof Error ? err.message : "モデルの取得に失敗しました。";
        return { models: [], error: message };
    }
}
electron_1.app.whenReady().then(() => {
    logger_1.default.info("App ready, configuring session headers");
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const isDevServer = VITE_DEV_SERVER_URL && details.url.startsWith(VITE_DEV_SERVER_URL);
        const isLocalFile = details.url.startsWith("file://");
        if (!isDevServer && !isLocalFile) {
            callback({ responseHeaders: details.responseHeaders });
            return;
        }
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [CONTENT_SECURITY_POLICY.replace(/\n/g, " ")],
            },
        });
    });
    config = (0, configStore_1.loadConfig)();
    logger_1.default.info("Config loaded", { provider: config.llm.provider, defaultModel: config.llm.defaultModel });
    createWindow();
    if (!isDev) {
        startAutoUpdate();
    }
    else {
        logger_1.default.info("Skipping auto update in development mode");
    }
    mcpClient_1.mcpClient.loadServers(config.mcp.servers);
    mcpClient_1.mcpClient.connectEnabled();
    electron_1.ipcMain.handle("settings:get", () => config);
    electron_1.ipcMain.handle("settings:save", (_event, updated) => {
        config = updated;
        (0, configStore_1.saveConfig)(config);
        mcpClient_1.mcpClient.loadServers(config.mcp.servers);
        mcpClient_1.mcpClient.connectEnabled();
        logger_1.default.info("Settings saved", { provider: config.llm.provider, defaultModel: config.llm.defaultModel });
        return config;
    });
    electron_1.ipcMain.handle("mcp:listServers", () => mcpClient_1.mcpClient.listServers());
    electron_1.ipcMain.handle("mcp:getStatus", () => mcpClient_1.mcpClient.getStatuses());
    electron_1.ipcMain.handle("app:openLogsFolder", () => {
        const logPath = logger_1.default.transports.file.getFile().path;
        logger_1.default.info("Opening logs folder");
        electron_1.shell.showItemInFolder(logPath);
        return { path: logPath };
    });
    electron_1.ipcMain.handle("models:list", async () => {
        if (config.llm.provider === "openrouter") {
            const result = await fetchOpenRouterModels(config.llm.apiKeyEncrypted);
            return result;
        }
        // Fallback: static list for non-OpenRouter providers
        return {
            models: [
                { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
                { id: "gpt-4.1", name: "gpt-4.1" },
                { id: "o1-mini", name: "o1-mini" },
            ],
        };
    });
    electron_1.ipcMain.handle("oauth:openrouter", async () => {
        try {
            logger_1.default.info("Starting OpenRouter OAuth from renderer");
            const { key, provider } = await runOpenRouterOAuth();
            config = {
                ...config,
                llm: {
                    ...config.llm,
                    apiKeyEncrypted: key,
                    provider,
                },
            };
            (0, configStore_1.saveConfig)(config);
            logger_1.default.info("OpenRouter OAuth succeeded, key stored");
            return { key };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "OpenRouter OAuth に失敗しました";
            logger_1.default.error("OpenRouter OAuth failed", err);
            return { error: message };
        }
    });
    electron_1.ipcMain.handle("chat:sendMessage", async (_event, payload) => {
        const parseResult = schemas_1.ChatMessageSchema.safeParse(payload);
        if (!parseResult.success) {
            logger_1.default.error("Invalid IPC payload:", parseResult.error);
            return { error: "Invalid request parameters" };
        }
        if (!mainWindow)
            return { error: "Window not ready" };
        const { text, model, assistantId } = parseResult.data;
        logger_1.default.info("IPC chat:sendMessage called", { assistantId, model, provider: config?.llm.provider });
        mainWindow.webContents.send("chat:stateUpdate", "thinking");
        let full = "";
        const apiKey = config?.llm.apiKeyEncrypted;
        if (!apiKey) {
            const message = "APIキーが設定されていません。設定画面で入力してください。";
            logger_1.default.warn("API key missing, rejecting chat request", { assistantId });
            mainWindow.webContents.send("chat:error", { assistantId, code: "unauthorized", message });
            mainWindow.webContents.send("chat:stateUpdate", "error");
            return { error: message };
        }
        const messages = [];
        if (config?.llm.systemPrompt?.trim()) {
            messages.push({ role: "system", content: config.llm.systemPrompt.trim() });
        }
        messages.push({ role: "user", content: text });
        const controller = new AbortController();
        abortControllers.set(assistantId, controller);
        try {
            const baseURL = getBaseUrlForProvider(config.llm.provider);
            for await (const chunk of (0, llmService_1.streamResponse)(messages, { model, apiKey, signal: controller.signal, baseURL })) {
                if (typeof chunk !== "string") {
                    // TODO: ツール呼び出しは今後のフェーズで実装
                    continue;
                }
                full += chunk;
                mainWindow.webContents.send("chat:assistantChunk", { assistantId, chunk });
                mainWindow.webContents.send("chat:stateUpdate", "speaking");
            }
            mainWindow.webContents.send("chat:assistantMessage", {
                assistantId,
                content: full,
                model,
            });
            mainWindow.webContents.send("chat:stateUpdate", "idle");
            return { content: full };
        }
        catch (err) {
            const normalized = (0, llmService_1.normalizeLlmError)(err);
            const nextState = normalized.code === "aborted" ? "idle" : "error";
            logger_1.default.error("chat:sendMessage failed", { assistantId, code: normalized.code, message: normalized.message });
            mainWindow.webContents.send("chat:error", { assistantId, code: normalized.code, message: normalized.message });
            mainWindow.webContents.send("chat:stateUpdate", nextState);
            return { error: normalized.message };
        }
        finally {
            abortControllers.delete(assistantId);
        }
    });
    electron_1.ipcMain.handle("chat:abort", (_event, assistantId) => {
        const controller = abortControllers.get(assistantId);
        if (controller) {
            controller.abort();
            abortControllers.delete(assistantId);
            logger_1.default.info("chat:abort handled", { assistantId });
            return { aborted: true };
        }
        logger_1.default.warn("chat:abort requested but controller not found", { assistantId });
        return { aborted: false, reason: "not-found" };
    });
    mcpClient_1.mcpClient.on("status", (status) => {
        if (mainWindow) {
            mainWindow.webContents.send("mcp:statusChanged", status);
        }
    });
    electron_1.app.on("activate", () => {
        logger_1.default.info("App activated");
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            logger_1.default.info("Recreating main window after activate");
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        logger_1.default.info("Quitting application because all windows are closed");
        electron_1.app.quit();
    }
});
