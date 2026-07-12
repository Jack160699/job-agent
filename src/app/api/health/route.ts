import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import prisma from "@/lib/db";

function envStatus(key: string, optional = false): string {
  const value = process.env[key];
  if (!value || value.includes("your-") || value.includes("placeholder")) {
    return optional ? "optional" : "missing";
  }
  return "configured";
}

export async function GET() {
  const checks: Record<string, string | boolean | number> = {
    status: "ok",
    supabase: isSupabaseConfigured() ? "configured" : "missing",
    database: "unknown",
    openai: envStatus("OPENAI_API_KEY"),
    google_oauth: envStatus("GOOGLE_CLIENT_ID", true),
    encryption: process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32
      ? "configured"
      : "missing",
    cron: envStatus("CRON_SECRET"),
    browser: process.env.VERCEL ? "queued_worker" : envStatus("BROWSER_MCP_BRIDGE_URL", true),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.2.0-rc.1",
    deployment: process.env.VERCEL_URL || "local",
  };

  try {
    getEnv();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";

    const pendingJobs = await prisma.backgroundJob.count({
      where: { status: "pending" },
    });
    checks.background_jobs_pending = pendingJobs;
  } catch (error) {
    checks.status = "degraded";
    checks.database = error instanceof Error ? error.message : "failed";
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
