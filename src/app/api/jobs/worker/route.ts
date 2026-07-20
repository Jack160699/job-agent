import { NextRequest, NextResponse, after } from "next/server";
import { verifyCronSecret } from "@/lib/security/rate-limit";
import {
  claimAndProcessJob,
  processBackgroundJobs,
} from "@/lib/jobs/background";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const source = (body as { source?: string }).source ?? "unknown";
    const jobId = (body as { jobId?: unknown }).jobId;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        component: "jobs-worker-api",
        event: "worker_invoked",
        source,
        jobId: typeof jobId === "string" ? jobId : undefined,
      })
    );

    if (typeof jobId === "string" && jobId.length > 0) {
      after(async () => {
        try {
          await claimAndProcessJob(jobId);
        } catch (error) {
          console.error(
            JSON.stringify({
              ts: new Date().toISOString(),
              component: "jobs-worker-api",
              event: "targeted_worker_error",
              jobId,
              error: error instanceof Error ? error.message : String(error),
            })
          );
        }
      });
      return NextResponse.json({ accepted: true, jobId }, { status: 202 });
    }

    const results = await processBackgroundJobs();
    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        component: "jobs-worker-api",
        event: "worker_error",
        error: message,
      })
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
