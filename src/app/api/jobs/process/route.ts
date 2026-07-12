import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveApiUserDev, createAuditLog, prisma } from "@/lib/api/auth";
import {
  analyzeJob,
  matchJob,
  processApplication,
  runFullPipeline,
} from "@/lib/jobs/pipeline";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const body = await request.json();
    const { action, jobId, applicationId } = body;

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
          await processApplication(user.id, applicationId)
        );

      case "pipeline":
        if (!jobId) throw new Error("jobId required");
        return NextResponse.json(await runFullPipeline(user.id, jobId));

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
