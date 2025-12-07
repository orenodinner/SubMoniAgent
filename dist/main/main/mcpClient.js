"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpClient = void 0;
const events_1 = require("events");
class McpClient extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.servers = [];
        this.statuses = [];
    }
    loadServers(servers) {
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
exports.mcpClient = new McpClient();
