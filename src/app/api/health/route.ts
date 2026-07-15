import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getQueueStats } from "@/lib/jobs/background";
import prisma from "@/lib/db";
import { isAdminUser } from "@/lib/auth/admin";

export async function GET() {
  const publicChecks: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    publicChecks.database = "connected";
  } catch {
    publicChecks.status = "degraded";
    publicChecks.database = "unavailable";
    return NextResponse.json(publicChecks, { status: 503 });
  }

  const admin = await isAdminUser().catch(() => false);
  if (!admin) {
    return NextResponse.json(publicChecks, { status: 200 });
  }

  try {
    const pendingJobs = await prisma.backgroundJob.count({
      where: { status: "pending" },
    });
    const queueStats = await getQueueStats();

    return NextResponse.json(
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
  } catch {
    return NextResponse.json(
      { ...publicChecks, diagnostics: "unavailable" },
      { status: 200 }
    );
  }
}
