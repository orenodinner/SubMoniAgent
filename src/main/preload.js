const { contextBridge, ipcRenderer } = require("electron");
const rendererLog = require("electron-log/renderer");

rendererLog.errorHandler.startCatching({ showDialog: false });
rendererLog.transports.console.level = "debug";
rendererLog.transports.remote.level = "info";

contextBridge.exposeInMainWorld("api", {
  sendMessage: (payload) => ipcRenderer.invoke("chat:sendMessage", payload),
  abortMessage: (assistantId) => ipcRenderer.invoke("chat:abort", assistantId),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (config) => ipcRenderer.invoke("settings:save", config),
  listMcpServers: () => ipcRenderer.invoke("mcp:listServers"),
  getMcpStatus: () => ipcRenderer.invoke("mcp:getStatus"),
  openLogsFolder: () => ipcRenderer.invoke("app:openLogsFolder"),
  startOpenRouterOAuth: () => ipcRenderer.invoke("oauth:openrouter"),
  listModels: () => ipcRenderer.invoke("models:list"),
  onAssistantChunk: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("chat:assistantChunk", listener);
    return () => ipcRenderer.removeListener("chat:assistantChunk", listener);
  },
  onAssistantMessage: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("chat:assistantMessage", listener);
    return () => ipcRenderer.removeListener("chat:assistantMessage", listener);
  },
  onStateUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("chat:stateUpdate", listener);
    return () => ipcRenderer.removeListener("chat:stateUpdate", listener);
  },
  onChatError: (callback) => {
    const listener = (_event, error) => callback(error);
    ipcRenderer.on("chat:error", listener);
    return () => ipcRenderer.removeListener("chat:error", listener);
  },
  onMcpStatusChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("mcp:statusChanged", listener);
    return () => ipcRenderer.removeListener("mcp:statusChanged", listener);
  },
});

contextBridge.exposeInMainWorld("logger", {
  info: (...args) => rendererLog.info(...args),
  warn: (...args) => rendererLog.warn(...args),
  error: (...args) => rendererLog.error(...args),
  debug: (...args) => rendererLog.debug(...args),
});
