import { EventEmitter } from "events";

export type McpServer = {
  id: string;
  name: string;
  endpoint: string;
  apiKeyEncrypted?: string;
  enabled: boolean;
};

export type McpStatus = {
  id: string;
  name: string;
  connected: boolean;
};

class McpClient extends EventEmitter {
  private servers: McpServer[] = [];
  private statuses: McpStatus[] = [];

  loadServers(servers: McpServer[]) {
    this.servers = servers || [];
    this.statuses = this.servers.map((s) => ({ id: s.id, name: s.name, connected: false }));
    this.emit("status", this.statuses);
  }

  connectEnabled() {
    this.statuses = this.servers.map((server) => ({
      id: server.id,
      name: server.name,
      connected: !!server.enabled,
    }));
    this.emit("status", this.statuses);
  }

  listServers() {
    return this.servers;
  }

  getStatuses() {
    return this.statuses;
  }
}

export const mcpClient = new McpClient();
