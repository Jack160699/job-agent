import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { searchJobs } from "@/lib/jobs/pipeline";
import { resolveApiUserDev } from "@/lib/api/auth";
import {
  enqueueInteractiveSearch,
  processBackgroundJobs,
} from "@/lib/jobs/background";
import { hasMinimumPreferences } from "@/lib/jobs/preferences";
import prisma from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!hasMinimumPreferences(settings)) {
      return NextResponse.json(
        {
          error: "PREFERENCES_INCOMPLETE",
          message: "Complete job search preferences before running a search",
          redirect: "/dashboard/onboarding",
        },
        { status: 422 }
      );
    }

    const asyncMode =
      request.nextUrl.searchParams.get("async") === "true" ||
      request.headers.get("x-async-search") === "true";

    if (asyncMode) {
      const { job, deduped } = await enqueueInteractiveSearch(user.id);
      after(() => {
        processBackgroundJobs().catch((err) =>
          console.error("[jobs/search] after() failed:", err)
        );
      });
      return NextResponse.json({
        queued: true,
        status: job.status,
        jobId: job.id,
        deduped,
        queuedAt: job.queuedAt.toISOString(),
      });
    }

    const result = await Promise.race([
      searchJobs(user.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timed out")), 45000)
      ),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    if (message === "PREFERENCES_INCOMPLETE") {
      return NextResponse.json(
        { error: message, redirect: "/dashboard/onboarding" },
        { status: 422 }
      );
    }
    if (message === "Search timed out") {
      const user = await resolveApiUserDev().catch(() => null);
      if (user) {
        const { job } = await enqueueInteractiveSearch(user.id);
        return NextResponse.json({
          queued: true,
          status: "pending",
          jobId: job.id,
          message,
        });
      }
    }
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
