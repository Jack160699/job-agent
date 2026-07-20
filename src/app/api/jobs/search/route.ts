import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { searchJobs } from "@/lib/jobs/pipeline";
import { resolveApiUser } from "@/lib/api/auth";
import {
  cancelActiveJob,
  claimAndProcessJob,
  enqueueInteractiveSearch,
  pauseActiveJob,
  resumePausedJob,
} from "@/lib/jobs/background";
import { validateSearchPreferences } from "@/lib/jobs/preferences";
import { EntitlementError } from "@/lib/entitlements";
import prisma from "@/lib/db";
import { JobSource } from "@prisma/client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  try {
    const authStart = Date.now();
    const user = await resolveApiUser();
    const authResolutionMs = Date.now() - authStart;
    const limited = await rateLimit(request, {
      ...RATE_LIMIT_PRESETS.jobSearch,
      keyPrefix: "job-search",
      userId: user.id,
    });
    if (limited) return limited;

    const dbStart = Date.now();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    const databaseQueryMs = Date.now() - dbStart;

    const preferenceValidation = validateSearchPreferences(settings);
    if (preferenceValidation.missing.length > 0) {
      return NextResponse.json(
        {
          error: "PREFERENCES_INCOMPLETE",
          message: "Complete job search preferences before running a search",
          missing: preferenceValidation.missing,
          redirect: "/dashboard/onboarding",
        },
        { status: 422 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      source?: string;
    };
    const requestedSource = body.source;
    if (
      requestedSource &&
      !Object.values(JobSource).includes(requestedSource as JobSource)
    ) {
      return NextResponse.json(
        { error: "UNKNOWN_SOURCE", message: "Choose a supported source." },
        { status: 400 }
      );
    }

    const asyncMode =
      request.nextUrl.searchParams.get("async") === "true" ||
      request.headers.get("x-async-search") === "true" ||
      Boolean(requestedSource);

    if (asyncMode) {
      const queueStart = Date.now();
      const source = requestedSource as JobSource | undefined;
      const { job, deduped } = await enqueueInteractiveSearch(user.id, {
        sources: source ? [source] : undefined,
        ignoreSourceCooldown: Boolean(source),
      });
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
        retrySource: source ?? null,
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
  try {
    const user = await resolveApiUser();
    const limited = await rateLimit(request, {
      ...RATE_LIMIT_PRESETS.jobSearch,
      keyPrefix: "job-search",
      userId: user.id,
    });
    if (limited) return limited;
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

export async function PATCH(request: NextRequest) {
  try {
    const user = await resolveApiUser();
    const limited = await rateLimit(request, {
      ...RATE_LIMIT_PRESETS.jobSearch,
      keyPrefix: "job-search",
      userId: user.id,
    });
    if (limited) return limited;
    const body = (await request.json()) as { action?: "pause" | "resume" };
    if (body.action === "pause") {
      const count = await pauseActiveJob(user.id, "SEARCH_JOBS");
      return NextResponse.json({
        paused: count > 0,
        message:
          count > 0
            ? "Pausing safely after the current source step."
            : "No active search was found.",
      });
    }
    if (body.action === "resume") {
      const job = await resumePausedJob(user.id, "SEARCH_JOBS");
      if (job) {
        after(() => {
          claimAndProcessJob(job.id).catch((error) =>
            console.error("[jobs/search] resume claim failed:", error)
          );
        });
      }
      return NextResponse.json({
        resumed: Boolean(job),
        jobId: job?.id ?? null,
        message: job ? "Search resumed." : "No paused search was found.",
      });
    }
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search control failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
