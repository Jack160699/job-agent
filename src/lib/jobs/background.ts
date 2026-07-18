import prisma from "@/lib/db";
import { searchJobs } from "@/lib/jobs/pipeline";
import { createAuditLog } from "@/lib/audit";
import { getAppBaseUrl } from "@/lib/brand/urls";
import type { Prisma } from "@prisma/client";

export type JobType =
  | "SEARCH_JOBS"
  | "ANALYZE_JOBS"
  | "PROCESS_APPLICATIONS"
  | "SYNC_GMAIL"
  | "SYNC_SHEETS"
  | "SYNC_CALENDAR"
  | "RUN_AGENT"
  | "GENERATE_RECOMMENDATIONS"
  | "RETRY_FAILED"
  | "ENRICH_RESUME";

interface JobPayload {
  userId?: string;
  jobId?: string;
  applicationId?: string;
  resumeId?: string;
}

const INTERACTIVE_PRIORITY = 100;
const SCHEDULED_PRIORITY = 0;
const STALE_HEARTBEAT_MS = 3 * 60 * 1000;
const STALE_RUNNING_MS = 10 * 60 * 1000;
const BATCH_SIZE = 10;

function logWorker(event: string, data: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      component: "background-worker",
      event,
      ...data,
    })
  );
}

const WORKER_KICK_TIMEOUT_MS = 4000;

/**
 * Best-effort remote kick — used as a secondary signal alongside the
 * request-scoped after() call in the API routes that create jobs. Bounded to
 * a short timeout so a slow/unreachable self-fetch can never hang the caller,
 * and failures are logged (never silently swallowed) so a broken kick is
 * visible instead of silently degrading every search to the cron fallback.
 */
export function triggerWorkerRemote(): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    triggerBackgroundProcessing().catch((err) =>
      logWorker("worker_trigger_local_failed", {
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_KICK_TIMEOUT_MS);

  fetch(`${getAppBaseUrl()}/api/jobs/worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "enqueue" }),
    signal: controller.signal,
  })
    .catch((err) => {
      logWorker("worker_trigger_remote_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return triggerBackgroundProcessing().catch(() => {});
    })
    .finally(() => clearTimeout(timeout));
}

export async function recoverStaleJobs() {
  const staleThreshold = new Date(Date.now() - STALE_HEARTBEAT_MS);
  const runningThreshold = new Date(Date.now() - STALE_RUNNING_MS);

  const recovered = await prisma.backgroundJob.updateMany({
    where: {
      status: "running",
      OR: [
        { heartbeatAt: { lt: staleThreshold } },
        { heartbeatAt: null, startedAt: { lt: runningThreshold } },
      ],
    },
    data: {
      status: "pending",
      scheduledAt: new Date(),
      claimedAt: null,
      startedAt: null,
      heartbeatAt: null,
      error: "Recovered stale running job",
    },
  });

  if (recovered.count > 0) {
    logWorker("stale_jobs_recovered", { count: recovered.count });
  }
  return recovered.count;
}

export async function archiveStaleScheduledJobs() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const archived = await prisma.backgroundJob.updateMany({
    where: {
      status: "pending",
      source: "scheduled",
      priority: { lt: INTERACTIVE_PRIORITY },
      createdAt: { lt: cutoff },
    },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      error: "Archived stale scheduled job",
    },
  });
  if (archived.count > 0) {
    logWorker("stale_scheduled_archived", { count: archived.count });
  }
  return archived.count;
}

export async function getActiveSearchJob(userId: string) {
  return prisma.backgroundJob.findFirst({
    where: {
      userId,
      type: "SEARCH_JOBS",
      status: { in: ["pending", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelActiveJob(userId: string, type: JobType) {
  const result = await prisma.backgroundJob.updateMany({
    where: {
      userId,
      type,
      status: { in: ["pending", "running"] },
    },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      error: "Cancelled by user",
      progressStage: "cancelled",
    },
  });
  if (result.count > 0) {
    logWorker("job_cancelled_by_user", { userId, type, count: result.count });
  }
  return result.count;
}

/** Idempotent interactive search — returns existing active job or creates a prioritized one. */
export async function enqueueInteractiveSearch(userId: string) {
  await recoverStaleJobs();

  // Cancel any stale pending searches so a fresh interactive run can start
  await prisma.backgroundJob.updateMany({
    where: {
      userId,
      type: "SEARCH_JOBS",
      status: "pending",
    },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      error: "Superseded by new interactive search",
    },
  });

  const existing = await prisma.backgroundJob.findFirst({
    where: {
      userId,
      type: "SEARCH_JOBS",
      status: "running",
      source: "interactive",
    },
  });
  if (existing) {
    logWorker("search_deduped", { jobId: existing.id, userId });
    triggerWorkerRemote();
    return { job: existing, deduped: true };
  }

  const now = new Date();
  const job = await prisma.backgroundJob.create({
    data: {
      type: "SEARCH_JOBS",
      payload: { userId } as Prisma.InputJsonValue,
      status: "pending",
      priority: INTERACTIVE_PRIORITY,
      source: "interactive",
      userId,
      scheduledAt: now,
      queuedAt: now,
      progressStage: "validating_preferences",
      progressPercent: 0,
    },
  });

  logWorker("queue_created", {
    jobId: job.id,
    type: "SEARCH_JOBS",
    userId,
    priority: INTERACTIVE_PRIORITY,
    source: "interactive",
  });

  triggerWorkerRemote();
  return { job, deduped: false };
}

export async function enqueueJob(
  type: JobType,
  payload?: JobPayload,
  opts?: { priority?: number; source?: string }
) {
  const now = new Date();
  const job = await prisma.backgroundJob.create({
    data: {
      type,
      payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "pending",
      priority: opts?.priority ?? SCHEDULED_PRIORITY,
      source: opts?.source ?? "scheduled",
      userId: payload?.userId,
      scheduledAt: now,
      queuedAt: now,
    },
  });

  logWorker("queue_created", {
    jobId: job.id,
    type,
    userId: payload?.userId,
    priority: opts?.priority ?? SCHEDULED_PRIORITY,
  });

  triggerWorkerRemote();
  return job;
}

let processingPromise: Promise<unknown> | null = null;

export function triggerBackgroundProcessing() {
  if (!processingPromise) {
    processingPromise = processBackgroundJobs().finally(() => {
      processingPromise = null;
    });
  }
  return processingPromise;
}

type WorkerResult = {
  id: string;
  status: string;
  result?: unknown;
  error?: string;
};

/**
 * Atomically claims and fully executes a single job row, if it is still
 * pending. Extracted so a targeted interactive kick (claimAndProcessJob) and
 * the batch drain (processBackgroundJobs) share identical claim/execute/
 * complete/fail semantics — no duplicate-claim risk, no divergent behavior.
 */
async function claimAndRunJob(job: {
  id: string;
  type: string;
  priority: number;
  source: string;
  attempts: number;
  maxAttempts: number;
  queuedAt: Date;
  payload: unknown;
}): Promise<WorkerResult | null> {
  const payload = (job.payload as JobPayload) || {};
  const claimTime = new Date();

  try {
    const claimed = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: {
        status: "running",
        claimedAt: claimTime,
        startedAt: claimTime,
        heartbeatAt: claimTime,
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 0) return null;

    logWorker("worker_picked_job", {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
      source: job.source,
      userId: payload.userId,
      queueClaimLatencyMs: claimTime.getTime() - job.queuedAt.getTime(),
    });

    let result: unknown;

    switch (job.type as JobType) {
      case "SEARCH_JOBS":
        if (payload.userId) {
          result = await searchJobs(payload.userId, job.id);
        } else {
          throw new Error("SEARCH_JOBS missing userId");
        }
        break;
      case "ANALYZE_JOBS":
        if (payload.userId && payload.jobId) {
          const { analyzeJob } = await import("@/lib/jobs/pipeline");
          result = await analyzeJob(payload.userId, payload.jobId);
        }
        break;
      case "PROCESS_APPLICATIONS":
        if (payload.userId && payload.applicationId) {
          const { processApplication } = await import("@/lib/jobs/pipeline");
          result = await processApplication(
            payload.userId,
            payload.applicationId
          );
        }
        break;
      case "SYNC_GMAIL":
        if (payload.userId) {
          const { syncGmail } = await import("@/lib/google/gmail");
          result = await syncGmail(payload.userId);
        }
        break;
      case "SYNC_SHEETS":
        if (payload.userId) {
          const { syncApplicationsToSheet } = await import("@/lib/google/sheets");
          result = await syncApplicationsToSheet(payload.userId);
        }
        break;
      case "SYNC_CALENDAR":
        if (payload.userId) {
          const { syncInterviewsToCalendar } = await import("@/lib/google/calendar");
          result = await syncInterviewsToCalendar(payload.userId);
        }
        break;
      case "RUN_AGENT":
        if (payload.userId) {
          const { runAutonomousAgent } = await import("@/lib/agent/orchestrator");
          result = await runAutonomousAgent(payload.userId);
        }
        break;
      case "GENERATE_RECOMMENDATIONS":
        if (payload.userId) {
          const { generateProactiveRecommendations } = await import(
            "@/lib/proactive/service"
          );
          result = await generateProactiveRecommendations(payload.userId);
        } else {
          throw new Error("GENERATE_RECOMMENDATIONS missing userId");
        }
        break;
      case "RETRY_FAILED":
        result = await retryFailedApplications(payload.userId);
        break;
      case "ENRICH_RESUME":
        if (payload.userId && payload.resumeId) {
          const { enrichMasterResume } = await import("@/lib/resumes/enrichment");
          result = await enrichMasterResume(payload.userId, payload.resumeId);
        } else {
          throw new Error("ENRICH_RESUME missing userId or resumeId");
        }
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    const completed = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "completed",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        progressStage: "completed",
        progressPercent: 100,
        error: null,
        progressMeta: result as Prisma.InputJsonValue,
      },
    });

    if (completed.count === 0) {
      const current = await prisma.backgroundJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (current?.status === "cancelled") {
        return { id: job.id, status: "cancelled" };
      }
      throw new Error("JOB_STATE_CHANGED");
    }

    logWorker("job_completed", { jobId: job.id, type: job.type });
    return { id: job.id, status: "completed", result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg === "JOB_CANCELLED") {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          error: "Cancelled by user",
          progressStage: "cancelled",
        },
      });
      return { id: job.id, status: "cancelled" };
    }
    const attemptsAfterFail = job.attempts + 1;
    const isDeadLetter = attemptsAfterFail >= job.maxAttempts;
    const willRetry = !isDeadLetter;

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: isDeadLetter ? "dead_letter" : willRetry ? "pending" : "failed",
        error: errorMsg,
        failedAt: isDeadLetter || !willRetry ? new Date() : null,
        progressStage: "failed",
        scheduledAt: willRetry
          ? new Date(Date.now() + 5 * 60 * 1000)
          : new Date(),
        claimedAt: null,
        startedAt: null,
        heartbeatAt: null,
      },
    });

    logWorker(isDeadLetter ? "job_dead_letter" : willRetry ? "job_retry_scheduled" : "job_failed", {
      jobId: job.id,
      type: job.type,
      error: errorMsg,
    });

    return {
      id: job.id,
      status: isDeadLetter ? "dead_letter" : willRetry ? "retry" : "failed",
      error: errorMsg,
    };
  }
}

/**
 * Targeted interactive kick: claims and runs exactly one known job, without
 * draining the whole queue behind it. This is what the enqueue path should
 * call for a fast, predictable claim latency instead of waiting behind
 * whatever else happens to be pending. Falls through silently (returns null)
 * if the job was already claimed by another invocation (idempotent) or no
 * longer exists/pending — the cron drain remains the recovery path.
 */
export async function claimAndProcessJob(jobId: string): Promise<WorkerResult | null> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "pending") return null;
  return claimAndRunJob(job);
}

export async function processBackgroundJobs() {
  await recoverStaleJobs();
  await archiveStaleScheduledJobs();

  const allResults: WorkerResult[] = [];

  while (true) {
    const jobs = await prisma.backgroundJob.findMany({
      where: {
        status: "pending",
        scheduledAt: { lte: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: [
        { priority: "desc" },
        { scheduledAt: "asc" },
        { createdAt: "asc" },
      ],
      take: BATCH_SIZE,
    });

    if (jobs.length === 0) {
      if (allResults.length === 0) logWorker("worker_idle");
      break;
    }

    logWorker("worker_batch_started", { count: jobs.length });

    for (const job of jobs) {
      const outcome = await claimAndRunJob(job);
      if (outcome) allResults.push(outcome);
    }

    if (jobs.length < BATCH_SIZE) break;
  }

  return allResults;
}

async function retryFailedApplications(userId?: string) {
  const where = {
    status: "FAILED" as const,
    retryCount: { lt: 3 },
    ...(userId ? { userId } : {}),
  };

  const failed = await prisma.application.findMany({ where, take: 5 });
  for (const app of failed) {
    await prisma.application.update({
      where: { id: app.id },
      data: {
        status: "PENDING_REVIEW",
        retryCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
    await enqueueJob("PROCESS_APPLICATIONS", {
      userId: app.userId,
      applicationId: app.id,
    });
  }

  await createAuditLog({
    userId,
    action: "RETRY_FAILED",
    message: `Retried ${failed.length} failed applications`,
    level: "INFO",
  });

  return { retried: failed.length };
}

export async function schedulePeriodicJobs() {
  const lastSchedule = await prisma.auditLog.findFirst({
    where: { action: "CRON_SCHEDULE_RUN" },
    orderBy: { createdAt: "desc" },
  });

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (lastSchedule && lastSchedule.createdAt.getTime() > dayAgo) {
    return { scheduled: 0, skipped: true };
  }

  const users = await prisma.user.findMany({
    include: { settings: true },
  });

  let scheduled = 0;
  for (const user of users) {
    if (!user.settings?.preferencesComplete) continue;
    await enqueueJob("SEARCH_JOBS", { userId: user.id }, { source: "scheduled" });
    await enqueueJob("RUN_AGENT", { userId: user.id }, { source: "scheduled" });
    if (user.settings.notificationsEnabled) {
      await enqueueJob(
        "GENERATE_RECOMMENDATIONS",
        { userId: user.id },
        { source: "scheduled" }
      );
    }
    scheduled++;
  }

  await createAuditLog({
    action: "CRON_SCHEDULE_RUN",
    message: `Scheduled periodic jobs for ${scheduled} users`,
    level: "INFO",
  });

  return { scheduled, skipped: false };
}

export async function getQueueStats() {
  const [pending, running, completed, failed, cancelled, interactivePending] =
    await Promise.all([
      prisma.backgroundJob.count({ where: { status: "pending" } }),
      prisma.backgroundJob.count({ where: { status: "running" } }),
      prisma.backgroundJob.count({ where: { status: "completed" } }),
      prisma.backgroundJob.count({ where: { status: "failed" } }),
      prisma.backgroundJob.count({ where: { status: "cancelled" } }),
      prisma.backgroundJob.count({
        where: { status: "pending", priority: { gte: INTERACTIVE_PRIORITY } },
      }),
    ]);

  return { pending, running, completed, failed, cancelled, interactivePending };
}
