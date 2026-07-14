import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.browserWorker,
    keyPrefix: "browser-status",
  });
  if (limited) return limited;

  try {
    await resolveApiUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bridgeUrl = process.env.BROWSER_MCP_BRIDGE_URL;
    let bridgeHealthy = false;

    if (bridgeUrl) {
      try {
        const headers: Record<string, string> = {};
        if (process.env.BROWSER_WORKER_TOKEN) {
          headers.Authorization = `Bearer ${process.env.BROWSER_WORKER_TOKEN}`;
        }
        const res = await fetch(`${bridgeUrl}/health`, {
          signal: AbortSignal.timeout(5000),
          headers,
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
      bridgeHealthy,
      headless: process.env.BROWSER_HEADLESS !== "false",
      queueEnabled: Boolean(process.env.VERCEL || process.env.BROWSER_QUEUE_ENABLED),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
