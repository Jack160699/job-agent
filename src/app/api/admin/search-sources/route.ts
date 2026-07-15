import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminUser } from "@/lib/auth/admin";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { sourceHealthRates } from "@/lib/jobs/source-health";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.admin,
    keyPrefix: "admin-search-sources",
  });
  if (limited) return limited;
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.jobSourceHealth.findMany({
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  return NextResponse.json({
    sources: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      source: row.source,
      requests: row.requests,
      successfulResponses: row.successfulResponses,
      emptyResponses: row.emptyResponses,
      invalidJobs: row.invalidJobs,
      duplicateJobs: row.duplicateJobs,
      expiredJobs: row.expiredJobs,
      failures: row.failures,
      consecutiveFailures: row.consecutiveFailures,
      lastSuccessfulFetch: row.lastSuccessfulFetch,
      disabledUntil: row.disabledUntil,
      lastError: row.lastError,
      updatedAt: row.updatedAt,
      rates: sourceHealthRates({
        requests: row.requests,
        successfulResponses: row.successfulResponses,
        emptyResponses: row.emptyResponses,
        invalidJobs: row.invalidJobs,
        duplicates: row.duplicateJobs,
        expiredJobs: row.expiredJobs,
        failures: row.failures,
        relevanceTotal: row.relevanceTotal,
        relevanceSamples: row.relevanceSamples,
        consecutiveFailures: row.consecutiveFailures,
        disabledUntil: row.disabledUntil,
      }),
    })),
  });
}
