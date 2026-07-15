import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser } from "@/lib/api/auth";
import {
  analyzeJob,
  matchJob,
  processApplication,
  runFullPipeline,
} from "@/lib/jobs/pipeline";
import { EntitlementError } from "@/lib/entitlements";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.jobSearch);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = await request.json();
    const { action, jobId, applicationId, force } = body;

    switch (action) {
      case "analyze":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await analyzeJob(user.id, jobId));

      case "match":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await matchJob(user.id, jobId));

      case "process":
        if (!applicationId) throw new Error("applicationId required");
        return NextResponse.json(
          await processApplication(user.id, applicationId, {
            force: Boolean(force),
          })
        );

      case "pipeline":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await runFullPipeline(user.id, jobId));

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          feature: error.feature,
          remaining: error.remaining,
        },
        { status: 402 }
      );
    }
    const message = error instanceof Error ? error.message : "Processing failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "JOB_NOT_ACTIVE"
          ? 409
        : message === "Application not found" || message === "Master resume required"
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
