import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import crypto from "crypto";
import { loadConfig, saveConfig } from "./configStore";
import { AppConfig } from "../shared/types";
import { streamResponse } from "./llmService";
import { mcpClient } from "./mcpClient";

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_CALLBACK_URL = "http://localhost:3000/";

function createWindow() {
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
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("mcp:statusChanged", mcpClient.getStatuses());
    mainWindow?.webContents.send("chat:stateUpdate", "idle");
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
  const codeVerifier = createCodeVerifier();
  const codeChallenge = createCodeChallenge(codeVerifier);
  const code = await openOpenRouterAuthWindow(codeChallenge);
  const key = await exchangeCodeForKey(code, codeVerifier);
  return { key, provider: "openrouter" as const };
}

app.whenReady().then(() => {
  config = loadConfig();
  createWindow();

  mcpClient.loadServers(config.mcp.servers);
  mcpClient.connectEnabled();

  ipcMain.handle("settings:get", () => config);

  ipcMain.handle("settings:save", (_event, updated: AppConfig) => {
    config = updated;
    saveConfig(config);
    mcpClient.loadServers(config.mcp.servers);
    mcpClient.connectEnabled();
    return config;
  });

  ipcMain.handle("mcp:listServers", () => mcpClient.listServers());
  ipcMain.handle("mcp:getStatus", () => mcpClient.getStatuses());

  ipcMain.handle("oauth:openrouter", async () => {
    try {
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
      return { key };
    } catch (err) {
      const message = err instanceof Error ? err.message : "OpenRouter OAuth に失敗しました";
      return { error: message };
    }
  });

  ipcMain.handle(
    "chat:sendMessage",
    async (_event, payload: { text: string; model: string; assistantId: string; sessionId?: string }) => {
      if (!mainWindow) return { error: "Window not ready" };
      mainWindow.webContents.send("chat:stateUpdate", "thinking");

      const { text, model, assistantId } = payload;
      let full = "";

      try {
        for await (const chunk of streamResponse(text, { model })) {
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
        const message = err instanceof Error ? err.message : "Unknown error";
        mainWindow.webContents.send("chat:stateUpdate", "error");
        return { error: message };
      }
    }
  );

  mcpClient.on("status", (status) => {
    if (mainWindow) {
      mainWindow.webContents.send("mcp:statusChanged", status);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});