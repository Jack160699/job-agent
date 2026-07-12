import prisma from "@/lib/db";
import { searchJobs } from "@/lib/jobs/pipeline";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export type JobType =
  | "SEARCH_JOBS"
  | "ANALYZE_JOBS"
  | "PROCESS_APPLICATIONS"
  | "SYNC_GMAIL"
  | "SYNC_SHEETS"
  | "SYNC_CALENDAR"
  | "RUN_AGENT"
  | "RETRY_FAILED";

interface JobPayload {
  userId?: string;
  jobId?: string;
  applicationId?: string;
}

export async function enqueueJob(type: JobType, payload?: JobPayload) {
  return prisma.backgroundJob.create({
    data: {
      type,
      payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "pending",
      scheduledAt: new Date(),
    },
  });
}

export async function processBackgroundJobs() {
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: new Date() },
      attempts: { lt: 3 },
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });

  const results = [];
  for (const job of jobs) {
    try {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
      });

      const payload = (job.payload as JobPayload) || {};
      let result: unknown;

      switch (job.type as JobType) {
        case "SEARCH_JOBS":
          if (payload.userId) {
            result = await searchJobs(payload.userId);
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
            result = await processApplication(payload.userId, payload.applicationId);
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
        case "RETRY_FAILED":
          result = await retryFailedApplications(payload.userId);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "completed", completedAt: new Date() },
      });

      results.push({ id: job.id, status: "completed", result });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: job.attempts >= 2 ? "failed" : "pending",
          error: errorMsg,
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      results.push({ id: job.id, status: "failed", error: errorMsg });
    }
  }

  return results;
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
  const users = await prisma.user.findMany({
    include: { settings: true },
  });

  for (const user of users) {
    if (!user.settings) continue;
    await enqueueJob("SEARCH_JOBS", { userId: user.id });
    await enqueueJob("RUN_AGENT", { userId: user.id });
    if (user.settings.gmailSyncEnabled) {
      await enqueueJob("SYNC_GMAIL", { userId: user.id });
    }
    if (user.settings.sheetsSyncEnabled) {
      await enqueueJob("SYNC_SHEETS", { userId: user.id });
    }
    if (user.settings.calendarSyncEnabled) {
      await enqueueJob("SYNC_CALENDAR", { userId: user.id });
    }
  }

  return { scheduled: users.length };
}
