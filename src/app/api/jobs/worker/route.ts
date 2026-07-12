import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/rate-limit";
import { processBackgroundJobs } from "@/lib/jobs/background";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        component: "jobs-worker-api",
        event: "worker_invoked",
        source: (body as { source?: string }).source ?? "unknown",
      })
    );

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
