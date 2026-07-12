import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import prisma from "@/lib/db";

export async function GET() {
  const checks: Record<string, string> = {
    status: "ok",
    supabase: isSupabaseConfigured() ? "configured" : "missing",
    database: "unknown",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  };

  try {
    getEnv();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch (error) {
    checks.status = "degraded";
    checks.database = error instanceof Error ? error.message : "failed";
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
