import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { loadConfig, saveConfig, AppConfig } from "./configStore";
import { streamResponse } from "./llmService";
import { mcpClient } from "./mcpClient";

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

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
