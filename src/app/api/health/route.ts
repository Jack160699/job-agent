import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getQueueStats } from "@/lib/jobs/background";
import prisma from "@/lib/db";
import { isAdminUser } from "@/lib/auth/admin";

export async function GET() {
  const requestStart = performance.now();
  const timings: string[] = [];
  const publicChecks: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    const databaseStart = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    timings.push(`database;dur=${(performance.now() - databaseStart).toFixed(1)}`);
    publicChecks.database = "connected";
  } catch {
    publicChecks.status = "degraded";
    publicChecks.database = "unavailable";
    const response = NextResponse.json(publicChecks, { status: 503 });
    response.headers.set(
      "Server-Timing",
      `${timings.join(", ")}, total;dur=${(performance.now() - requestStart).toFixed(1)}`
    );
    response.headers.set(
      "X-Kairela-Server-Timing",
      response.headers.get("Server-Timing") ?? ""
    );
    return response;
  }

  // Admin diagnostics require verifying the caller's session, which is a
  // real network round trip to Supabase's auth server (auth.getUser() is
  // deliberately server-verified, not a locally-decoded JWT — see
  // lib/auth/server.ts). The overwhelming majority of health-check callers
  // (uptime monitors, load balancers, our own smoke tests) have no session
  // cookie at all, so skip that round trip entirely when there's nothing
  // to verify — this is what was making every anonymous health check pay
  // ~1s+ of unnecessary auth-server latency.
  const hasSessionCookie = (await cookies())
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const authStart = performance.now();
  const admin = hasSessionCookie ? await isAdminUser().catch(() => false) : false;
  timings.push(`authentication;dur=${(performance.now() - authStart).toFixed(1)}`);
  if (!admin) {
    const response = NextResponse.json(publicChecks, { status: 200 });
    response.headers.set(
      "Server-Timing",
      `${timings.join(", ")}, total;dur=${(performance.now() - requestStart).toFixed(1)}`
    );
    response.headers.set(
      "X-Kairela-Server-Timing",
      response.headers.get("Server-Timing") ?? ""
    );
    return response;
  }

  try {
    const diagnosticsStart = performance.now();
    const pendingJobs = await prisma.backgroundJob.count({
      where: { status: "pending" },
    });
    const queueStats = await getQueueStats();
    timings.push(
      `diagnostics;dur=${(performance.now() - diagnosticsStart).toFixed(1)}`
    );

    const response = NextResponse.json(
      {
        ...publicChecks,
        supabase: isSupabaseConfigured() ? "configured" : "missing",
        openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
        google_oauth: process.env.GOOGLE_CLIENT_ID ? "configured" : "missing",
        encryption:
          process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32
            ? "configured"
            : "missing",
        cron: process.env.CRON_SECRET ? "configured" : "missing",
        browser: process.env.VERCEL
          ? "queued_worker"
          : process.env.BROWSER_MCP_BRIDGE_URL
            ? "configured"
            : "optional",
        version: process.env.npm_package_version || "0.4.0-rc.1",
        deployment: process.env.VERCEL_URL || "local",
        background_jobs_pending: pendingJobs,
        queue: queueStats,
      },
      { status: 200 }
    );
    response.headers.set(
      "Server-Timing",
      `${timings.join(", ")}, total;dur=${(performance.now() - requestStart).toFixed(1)}`
    );
    response.headers.set(
      "X-Kairela-Server-Timing",
      response.headers.get("Server-Timing") ?? ""
    );
    return response;
  } catch {
    const response = NextResponse.json(
      { ...publicChecks, diagnostics: "unavailable" },
      { status: 200 }
    );
    response.headers.set(
      "Server-Timing",
      `${timings.join(", ")}, total;dur=${(performance.now() - requestStart).toFixed(1)}`
    );
    response.headers.set(
      "X-Kairela-Server-Timing",
      response.headers.get("Server-Timing") ?? ""
    );
    return response;
  }
}
