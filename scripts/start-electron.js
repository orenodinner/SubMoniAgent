const { spawn } = require("child_process");
const path = require("path");
const electronPath = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const entry = path.join(__dirname, "dev-main.js");
const child = spawn(electronPath, [entry], {
  stdio: "inherit",
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
