const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  sendMessage: (payload) => ipcRenderer.invoke("chat:sendMessage", payload),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (config) => ipcRenderer.invoke("settings:save", config),
  listMcpServers: () => ipcRenderer.invoke("mcp:listServers"),
  getMcpStatus: () => ipcRenderer.invoke("mcp:getStatus"),
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
  onMcpStatusChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("mcp:statusChanged", listener);
    return () => ipcRenderer.removeListener("mcp:statusChanged", listener);
  },
});
