"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const main_1 = __importDefault(require("electron-log/main"));
const path_1 = __importDefault(require("path"));
// Keep main process logs in the app's userData folder so users can retrieve them easily.
main_1.default.transports.file.resolvePathFn = () => path_1.default.join(electron_1.app.getPath("userData"), "logs/main.log");
// Timestamped, leveled log format for easier triage.
main_1.default.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
// Verbose console in dev, quieter file in production.
main_1.default.transports.console.level = "debug";
main_1.default.transports.file.level = "info";
main_1.default.info("Application starting...");
main_1.default.info(`Version: ${electron_1.app.getVersion()}`);
main_1.default.info(`Platform: ${process.platform} (${process.arch})`);
exports.default = main_1.default;
