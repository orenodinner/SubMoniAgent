import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import crypto from "crypto";
import debug from "electron-debug";
import path from "path";
import unhandled from "electron-unhandled";
import { openNewGitHubIssue, debugInfo } from "electron-util";
import { loadConfig, saveConfig } from "./configStore";
import { AppConfig, LlmModel } from "../shared/types";
import { normalizeLlmError, streamResponse } from "./llmService";
import log from "./logger";
import type { ChatMessage } from "./llm/types";
import { mcpClient } from "./mcpClient";
import { ChatMessageSchema } from "../shared/schemas";

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;
const abortControllers = new Map<string, AbortController>();
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const isDev = !app.isPackaged;

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

if (isDev) {
  debug({ showDevTools: false });
}

unhandled({
  logger: (error) => log.error("Unhandled error", error),
  showDialog: true,
  reportButton: (error) =>
    openNewGitHubIssue({
      user: "pixelagent",
      repo: "pixelagent",
      body: `\`\`\`\n${error.stack ?? error}\n\`\`\`\n\n---\n${debugInfo()}`,
    }),
});

function createWindow() {
  log.info("Creating main window");
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 480,
    minWidth: 960,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "PixelAgent",
  });

  if (VITE_DEV_SERVER_URL) {
    log.info(`Loading renderer from dev server at ${VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    log.info(`Loading renderer from file://${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const targetUrl = details.url;
    if (targetUrl.startsWith("https://") || targetUrl.startsWith("http://")) {
      shell.openExternal(targetUrl);
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
    mainWindow?.webContents.send("mcp:statusChanged", mcpClient.getStatuses());
    mainWindow?.webContents.send("chat:stateUpdate", "idle");
    log.info("Renderer loaded");
  });
}

function createCodeVerifier() {
  return crypto.randomBytes(32).toString("hex");
}

function createCodeChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest().toString("base64url");
}

async function openOpenRouterAuthWindow(codeChallenge: string) {
  const callbackUrl = OPENROUTER_CALLBACK_URL;
  const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(
    codeChallenge
  )}&code_challenge_method=S256`;

  return new Promise<string>((resolve, reject) => {
    const authWindow = new BrowserWindow({
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

    const handleNavigation = (targetUrl: string) => {
      if (finished) return;
      if (targetUrl.startsWith(callbackUrl)) {
        finished = true;
        const url = new URL(targetUrl);
        const code = url.searchParams.get("code");
        cleanup();
        authWindow.close();
        if (code) {
          resolve(code);
        } else {
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

async function exchangeCodeForKey(code: string, codeVerifier: string) {
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
    } catch {
      return {};
    }
  })() as { key?: string; error?: string };

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
  log.info("Starting OpenRouter OAuth flow");
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const code = await openOpenRouterAuthWindow(codeChallenge);
  const key = await exchangeCodeForKey(code, codeVerifier);
  log.info("OpenRouter OAuth flow completed");
  return { key, provider: "openrouter" as const };
}

function getBaseUrlForProvider(provider: string | undefined) {
  if (provider === "openrouter") {
    return OPENROUTER_API_BASE;
  }
  return undefined;
}

async function fetchOpenRouterModels(apiKey: string): Promise<{ models: LlmModel[]; error?: string }> {
  if (!apiKey) {
    return { models: [], error: "APIキーが設定されていません。" };
  }

  try {
    log.info("Fetching OpenRouter models list");
    const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const bodyText = await response.text();
    const payload = (() => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return {};
      }
    })() as { data?: { id: string; name?: string; description?: string }[]; error?: string };

    if (!response.ok) {
      const message = payload?.error || bodyText || response.statusText;
      return { models: [], error: message };
    }

    const models =
      payload?.data?.map((model) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
      })) ?? [];

    return { models };
  } catch (err) {
    log.error("Failed to fetch OpenRouter models", err);
    const message = err instanceof Error ? err.message : "モデルの取得に失敗しました。";
    return { models: [], error: message };
  }
}

app.whenReady().then(() => {
  log.info("App ready, configuring session headers");
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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

  config = loadConfig();
  log.info("Config loaded", { provider: config.llm.provider, defaultModel: config.llm.defaultModel });
  createWindow();

  mcpClient.loadServers(config.mcp.servers);
  mcpClient.connectEnabled();

  ipcMain.handle("settings:get", () => config);

  ipcMain.handle("settings:save", (_event, updated: AppConfig) => {
    config = updated;
    saveConfig(config);
    mcpClient.loadServers(config.mcp.servers);
    mcpClient.connectEnabled();
    log.info("Settings saved", { provider: config.llm.provider, defaultModel: config.llm.defaultModel });
    return config;
  });

  ipcMain.handle("mcp:listServers", () => mcpClient.listServers());
  ipcMain.handle("mcp:getStatus", () => mcpClient.getStatuses());

  ipcMain.handle("app:openLogsFolder", () => {
    const logPath = log.transports.file.getFile().path;
    log.info("Opening logs folder");
    shell.showItemInFolder(logPath);
    return { path: logPath };
  });

  ipcMain.handle("models:list", async () => {
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

  ipcMain.handle("oauth:openrouter", async () => {
    try {
      log.info("Starting OpenRouter OAuth from renderer");
      const { key, provider } = await runOpenRouterOAuth();
      config = {
        ...config,
        llm: {
          ...config.llm,
          apiKeyEncrypted: key,
          provider,
        },
      };
      saveConfig(config);
      log.info("OpenRouter OAuth succeeded, key stored");
      return { key };
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenRouter OAuth に失敗しました";
      log.error("OpenRouter OAuth failed", err);
      return { error: message };
    }
  });

  ipcMain.handle(
    "chat:sendMessage",
    async (_event, payload: unknown) => {
      const parseResult = ChatMessageSchema.safeParse(payload);
      if (!parseResult.success) {
        log.error("Invalid IPC payload:", parseResult.error);
        return { error: "Invalid request parameters" };
      }

      if (!mainWindow) return { error: "Window not ready" };

      const { text, model, assistantId } = parseResult.data;
      log.info("IPC chat:sendMessage called", { assistantId, model, provider: config?.llm.provider });
      mainWindow.webContents.send("chat:stateUpdate", "thinking");

      let full = "";

      const apiKey = config?.llm.apiKeyEncrypted;
      if (!apiKey) {
        const message = "APIキーが設定されていません。設定画面で入力してください。";
        log.warn("API key missing, rejecting chat request", { assistantId });
        mainWindow.webContents.send("chat:error", { assistantId, code: "unauthorized", message });
        mainWindow.webContents.send("chat:stateUpdate", "error");
        return { error: message };
      }

      const messages: ChatMessage[] = [];
      if (config?.llm.systemPrompt?.trim()) {
        messages.push({ role: "system", content: config.llm.systemPrompt.trim() });
      }
      messages.push({ role: "user", content: text });

      const controller = new AbortController();
      abortControllers.set(assistantId, controller);

      try {
        const baseURL = getBaseUrlForProvider(config.llm.provider);
        for await (const chunk of streamResponse(messages, { model, apiKey, signal: controller.signal, baseURL })) {
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
      } catch (err) {
        const normalized = normalizeLlmError(err);
        const nextState = normalized.code === "aborted" ? "idle" : "error";
        log.error("chat:sendMessage failed", { assistantId, code: normalized.code, message: normalized.message });
        mainWindow.webContents.send("chat:error", { assistantId, code: normalized.code, message: normalized.message });
        mainWindow.webContents.send("chat:stateUpdate", nextState);
        return { error: normalized.message };
      } finally {
        abortControllers.delete(assistantId);
      }
    }
  );

  ipcMain.handle("chat:abort", (_event, assistantId: string) => {
    const controller = abortControllers.get(assistantId);
    if (controller) {
      controller.abort();
      abortControllers.delete(assistantId);
      log.info("chat:abort handled", { assistantId });
      return { aborted: true };
    }
    log.warn("chat:abort requested but controller not found", { assistantId });
    return { aborted: false, reason: "not-found" };
  });

  mcpClient.on("status", (status) => {
    if (mainWindow) {
      mainWindow.webContents.send("mcp:statusChanged", status);
    }
  });

  app.on("activate", () => {
    log.info("App activated");
    if (BrowserWindow.getAllWindows().length === 0) {
      log.info("Recreating main window after activate");
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    log.info("Quitting application because all windows are closed");
    app.quit();
  }
});
