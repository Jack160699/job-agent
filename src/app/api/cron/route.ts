import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/rate-limit";
import {
  processBackgroundJobs,
  schedulePeriodicJobs,
} from "@/lib/jobs/background";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [scheduled, processed] = await Promise.all([
      schedulePeriodicJobs(),
      processBackgroundJobs(),
    ]);

    return NextResponse.json({
      scheduled,
      processed: processed.length,
      results: processed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
