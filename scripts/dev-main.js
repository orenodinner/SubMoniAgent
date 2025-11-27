delete process.env.ELECTRON_RUN_AS_NODE;
require("ts-node/register/transpile-only");
const path = require("path");
const project = path.join(__dirname, "..", "src", "main", "main.ts");
require(project);
