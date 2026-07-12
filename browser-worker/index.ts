import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.production") });

import { startMcpBridgeServer } from "./automation/mcp-bridge-server";
import { startBrowserWorker } from "./worker";

const mode = process.env.BROWSER_WORKER_MODE || "all";

async function main() {
  if (mode === "bridge" || mode === "all") {
    startMcpBridgeServer();
  }
  if (mode === "worker" || mode === "all") {
    await startBrowserWorker();
  }
}

main().catch((err) => {
  console.error("[Browser Worker] startup failed:", err);
  process.exit(1);
});
