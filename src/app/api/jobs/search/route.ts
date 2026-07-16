import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { searchJobs } from "@/lib/jobs/pipeline";
import { resolveApiUser } from "@/lib/api/auth";
import {
  cancelActiveJob,
  claimAndProcessJob,
  enqueueInteractiveSearch,
} from "@/lib/jobs/background";
import { hasMinimumPreferences } from "@/lib/jobs/preferences";
import { EntitlementError } from "@/lib/entitlements";
import prisma from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.jobSearch);
  if (limited) return limited;

  const requestStart = Date.now();
  try {
    const authStart = Date.now();
    const user = await resolveApiUser();
    const authResolutionMs = Date.now() - authStart;

    const dbStart = Date.now();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    const databaseQueryMs = Date.now() - dbStart;

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
      const queueStart = Date.now();
      const { job, deduped } = await enqueueInteractiveSearch(user.id);
      const queueCreationMs = Date.now() - queueStart;

      // Targeted kick: claim and run this specific job only, rather than
      // draining the whole queue behind it. The remote fetch inside
      // enqueueInteractiveSearch() is a secondary best-effort signal; this
      // after() call is the primary, reliable one since it runs in the same
      // request-scoped execution context.
      if (!deduped) {
        after(() => {
          claimAndProcessJob(job.id).catch((err) =>
            console.error("[jobs/search] after() claim failed:", err)
          );
        });
      }

      const response = NextResponse.json({
        queued: true,
        status: job.status,
        jobId: job.id,
        deduped,
        queuedAt: job.queuedAt.toISOString(),
      });
      response.headers.set(
        "Server-Timing",
        `authResolutionMs;dur=${authResolutionMs}, databaseQueryMs;dur=${databaseQueryMs}, queueCreationMs;dur=${queueCreationMs}, totalMs;dur=${Date.now() - requestStart}`
      );
      return response;
    }

    const result = await Promise.race([
      searchJobs(user.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timed out")), 45000)
      ),
    ]);
    return NextResponse.json(result);
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
    const message = error instanceof Error ? error.message : "Search failed";
    if (message === "PREFERENCES_INCOMPLETE") {
      return NextResponse.json(
        { error: message, redirect: "/dashboard/onboarding" },
        { status: 422 }
      );
    }
    if (message === "Search timed out") {
      const user = await resolveApiUser().catch(() => null);
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

export async function DELETE(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.jobSearch);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const cancelled = await cancelActiveJob(user.id, "SEARCH_JOBS");
    return NextResponse.json({
      cancelled: cancelled > 0,
      message:
        cancelled > 0
          ? "Search cancelled. Results already saved remain available."
          : "No active search was found.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search cancellation failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
