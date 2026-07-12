import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { PlaywrightEngine } from "../playwright/engine";

const engine = new PlaywrightEngine();
const PORT = Number(process.env.BROWSER_MCP_PORT || 3847);
const AUTH_TOKEN = process.env.BROWSER_WORKER_TOKEN || "";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

const routes: Record<string, Handler> = {
  browser_open: async (args) => engine.open(args.sessionId as string | undefined),
  browser_navigate: async (args) =>
    engine.goto(args.url as string, args.sessionId as string | undefined),
  browser_goto: async (args) =>
    engine.goto(args.url as string, args.sessionId as string | undefined),
  browser_snapshot: async (args) => {
    const snap = await engine.snapshot(args.sessionId as string | undefined);
    return { ...snap, content: snap.yaml };
  },
  browser_click: async (args) =>
    engine.click(args.ref as string, args.sessionId as string | undefined),
  browser_type: async (args) =>
    engine.type(
      args.ref as string,
      args.text as string,
      args.sessionId as string | undefined
    ),
  browser_fill: async (args) => {
    if (args.fields) {
      return engine.fill(
        args.fields as Array<{ ref?: string; label?: string; name?: string; value: string }>,
        args.sessionId as string | undefined
      );
    }
    return engine.type(
      args.ref as string,
      args.value as string,
      args.sessionId as string | undefined
    );
  },
  browser_select_option: async (args) =>
    engine.select(
      args.ref as string,
      args.value as string,
      args.sessionId as string | undefined
    ),
  browser_select: async (args) =>
    engine.select(
      args.ref as string,
      args.value as string,
      args.sessionId as string | undefined
    ),
  browser_upload: async (args) =>
    engine.upload(
      args.ref as string,
      args.filePath as string,
      args.sessionId as string | undefined
    ),
  browser_wait: async (args) =>
    engine.wait(
      args.selector as string,
      (args.timeoutMs as number) || 15000,
      args.sessionId as string | undefined
    ),
  browser_waitForSelector: async (args) =>
    engine.wait(
      args.selector as string,
      (args.timeoutMs as number) || 15000,
      args.sessionId as string | undefined
    ),
  browser_take_screenshot: async (args) =>
    engine.screenshot(args.sessionId as string | undefined, args.label as string | undefined),
  browser_screenshot: async (args) =>
    engine.screenshot(args.sessionId as string | undefined, args.label as string | undefined),
  browser_extract: async (args) =>
    engine.extract(args.selector as string | undefined, args.sessionId as string | undefined),
  browser_submit: async (args) =>
    engine.submit(args.sessionId as string | undefined),
  browser_lock: async (args) => {
    if (args.action === "unlock") {
      return engine.close(args.sessionId as string | undefined);
    }
    return { locked: true };
  },
  health: async () => ({
    status: "ok",
    engine: "playwright",
    sessions: "active",
    uptime: process.uptime(),
  }),
};

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startMcpBridgeServer() {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    if (AUTH_TOKEN) {
      const auth = req.headers.authorization?.replace("Bearer ", "");
      if (auth !== AUTH_TOKEN) {
        send(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const action = url.pathname.replace(/^\//, "") || "health";

    if (req.method === "GET" && action === "health") {
      send(res, 200, await routes.health({}));
      return;
    }

    if (req.method !== "POST") {
      send(res, 405, { error: "Method not allowed" });
      return;
    }

    const handler = routes[action];
    if (!handler) {
      send(res, 404, { error: `Unknown action: ${action}`, available: Object.keys(routes) });
      return;
    }

    try {
      const body = await readBody(req);
      const result = await handler(body);
      send(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[MCP Bridge] ${action} failed:`, message);
      send(res, 500, { error: message });
    }
  });

  server.listen(PORT, () => {
    console.log(`[MCP Bridge] listening on http://0.0.0.0:${PORT}`);
    console.log(`[MCP Bridge] Actions: ${Object.keys(routes).join(", ")}`);
  });

  return server;
}

if (require.main === module) {
  startMcpBridgeServer();
}
