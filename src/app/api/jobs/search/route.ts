import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { searchJobs } from "@/lib/jobs/pipeline";
import { resolveApiUserDev } from "@/lib/api/auth";
import { enqueueJob } from "@/lib/jobs/background";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const asyncMode =
      request.nextUrl.searchParams.get("async") === "true" ||
      request.headers.get("x-async-search") === "true";

    if (asyncMode) {
      await enqueueJob("SEARCH_JOBS", { userId: user.id });
      return NextResponse.json({ queued: true, status: "pending" });
    }

    const result = await Promise.race([
      searchJobs(user.id),
      new Promise<{ total: number; new: number }>((_, reject) =>
        setTimeout(() => reject(new Error("Search timed out")), 45000)
      ),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    if (message === "Search timed out") {
      const user = await resolveApiUserDev().catch(() => null);
      if (user) await enqueueJob("SEARCH_JOBS", { userId: user.id });
      return NextResponse.json({ queued: true, status: "pending", message });
    }
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
