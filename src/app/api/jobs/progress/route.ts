import { NextRequest, NextResponse } from "next/server";
import { resolveApiUserDev } from "@/lib/api/auth";
import { getJobRunProgress } from "@/lib/jobs/progress";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveApiUserDev();
    const type = request.nextUrl.searchParams.get("type") as
      | "SEARCH_JOBS"
      | "RUN_AGENT"
      | null;

    const progress = await getJobRunProgress(
      user.id,
      type ?? undefined
    );

    return NextResponse.json({ progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get progress";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
