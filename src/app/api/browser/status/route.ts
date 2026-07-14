import { NextResponse } from "next/server";

export async function GET() {
  try {
    const bridgeUrl = process.env.BROWSER_MCP_BRIDGE_URL;
    let bridgeHealthy = false;

    if (bridgeUrl) {
      try {
        const res = await fetch(`${bridgeUrl}/health`, {
          signal: AbortSignal.timeout(5000),
          headers: process.env.BROWSER_WORKER_TOKEN
            ? { Authorization: `Bearer ${process.env.BROWSER_WORKER_TOKEN}` }
            : {},
        });
        bridgeHealthy = res.ok;
      } catch {
        bridgeHealthy = false;
      }
    }

    return NextResponse.json({
      status: "ok",
      mode: bridgeUrl
        ? bridgeHealthy
          ? "mcp_bridge"
          : "mcp_bridge_unreachable"
        : process.env.VERCEL
          ? "queued_worker"
          : "local_playwright",
      bridgeUrl: bridgeUrl || null,
      bridgeHealthy,
      headless: process.env.BROWSER_HEADLESS !== "false",
      queueEnabled: Boolean(process.env.VERCEL || process.env.BROWSER_QUEUE_ENABLED),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
