import { app } from "electron";
import log from "electron-log/main";
import path from "path";

// Keep main process logs in the app's userData folder so users can retrieve them easily.
log.transports.file.resolvePathFn = () => path.join(app.getPath("userData"), "logs/main.log");

// Timestamped, leveled log format for easier triage.
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

// Verbose console in dev, quieter file in production.
log.transports.console.level = "debug";
log.transports.file.level = "info";

log.info("Application starting...");
log.info(`Version: ${app.getVersion()}`);
log.info(`Platform: ${process.platform} (${process.arch})`);

export default log;
