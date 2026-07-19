import prisma from "@/lib/db";
import {
  SEARCH_STAGE_LABELS,
  type SearchProgressStage,
} from "@/lib/jobs/preferences";

export type JobRunStage =
  | SearchProgressStage
  | "queued"
  | "failed"
  | "paused";

export interface JobRunProgress {
  jobId: string | null;
  type: string;
  status:
    | "pending"
    | "running"
    | "pause_requested"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  stage: JobRunStage;
  stageLabel: string;
  progress: number;
  jobsFound: number;
  jobsNew: number;
  jobsRelevant: number;
  jobsExcluded: number;
  failedSources: Array<{ source: string; error?: string }>;
  summary: string | null;
  currentCompany: string | null;
  currentAts: string | null;
  queuePosition: number | null;
  estimatedSecondsRemaining: number | null;
  logs: Array<{ time: string; level: string; message: string }>;
  error: string | null;
  startedAt: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  stalled: boolean;
  result: Record<string, unknown> | null;
}

export async function getJobRunProgress(
  userId: string,
  type?: "SEARCH_JOBS" | "RUN_AGENT"
): Promise<JobRunProgress | null> {
  const jobTypes = type ? [type] : ["SEARCH_JOBS", "RUN_AGENT"];

  const latestJob = await prisma.backgroundJob.findFirst({
    where: {
      userId,
      type: { in: jobTypes },
      status: { notIn: ["cancelled"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latestJob) return null;

  const [interactiveAhead, auditLogs] = await Promise.all([
    latestJob.status === "pending"
      ? prisma.backgroundJob.count({
          where: {
            status: "pending",
            priority: { gte: latestJob.priority },
            OR: [
              { priority: { gt: latestJob.priority } },
              { queuedAt: { lt: latestJob.queuedAt } },
            ],
          },
        })
      : Promise.resolve(0),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return buildProgress(latestJob, interactiveAhead, auditLogs);
}

function buildProgress(
  job: {
    id: string;
    type: string;
    status: string;
    error: string | null;
    startedAt: Date | null;
    claimedAt: Date | null;
    completedAt: Date | null;
    queuedAt: Date;
    heartbeatAt: Date | null;
    createdAt: Date;
    progressStage: string | null;
    progressPercent: number;
    progressMeta: unknown;
    payload: unknown;
    source: string;
  },
  queuePosition: number,
  auditLogs: Array<{
    level: string;
    action: string;
    message: string;
    createdAt: Date;
  }>
): JobRunProgress {
  const meta = (job.progressMeta as Record<string, unknown>) || {};
  let stage: JobRunStage =
    (job.progressStage as SearchProgressStage) ||
    (job.status === "pending" ? "queued" : "validating_preferences");

  if (job.status === "pending" && !job.progressStage) stage = "queued";
  if (job.status === "failed") stage = "failed";
  if (job.status === "completed") stage = "completed";
  if (job.status === "paused" || job.status === "pause_requested") {
    stage = "paused";
  }

  const stageLabel =
    stage === "queued"
      ? job.source === "interactive"
        ? "Starting your search…"
        : "Waiting in queue"
      : stage === "paused"
        ? job.status === "pause_requested"
          ? "Pausing after the current source step"
          : "Search paused"
      : (typeof meta.label === "string" && meta.label) ||
        SEARCH_STAGE_LABELS[stage as SearchProgressStage] ||
        stage;

  let progress = job.progressPercent;
  if (job.status === "completed") progress = 100;
  if (job.status === "pending" && stage === "queued") progress = 5;

  const discoverMatch = auditLogs
    .find((l) => l.action === "JOB_SEARCH_COMPLETE")
    ?.message.match(/Found (\d+) raw, (\d+) relevant, (\d+) new \((\d+) excluded\)/);

  const jobsFound = discoverMatch
    ? parseInt(discoverMatch[1], 10)
    : (meta.rawCount as number) || 0;
  const jobsRelevant = discoverMatch
    ? parseInt(discoverMatch[2], 10)
    : (meta.relevant as number) || 0;
  const jobsNew = discoverMatch
    ? parseInt(discoverMatch[3], 10)
    : (meta.new as number) || 0;
  const jobsExcluded = discoverMatch
    ? parseInt(discoverMatch[4], 10)
    : (meta.excluded as number) || 0;
  const sources = Array.isArray(meta.sources)
    ? (meta.sources as Array<{
        source?: string;
        success?: boolean;
        error?: string;
      }>)
    : [];
  const failedSources = sources
    .filter((source) => source.source && !source.success)
    .map((source) => ({
      source: String(source.source),
      error: source.error,
    }));
  const summary =
    job.status === "completed"
      ? `Found ${jobsFound} raw roles, ${jobsRelevant} relevant, ${jobsNew} new, ${jobsExcluded} excluded${
          typeof meta.duplicates === "number"
            ? `, removed ${meta.duplicates} duplicates`
            : ""
        }.`
      : typeof meta.label === "string"
        ? meta.label
        : null;

  const heartbeatStale =
    job.status === "running" &&
    job.heartbeatAt != null &&
    Date.now() - job.heartbeatAt.getTime() > 3 * 60 * 1000;

  const claimedStale =
    job.status === "pending" &&
    job.source === "interactive" &&
    Date.now() - job.queuedAt.getTime() > 30 * 1000;

  return {
    jobId: job.id,
    type: job.type,
    status: job.status as JobRunProgress["status"],
    stage,
    stageLabel,
    progress,
    jobsFound,
    jobsNew,
    jobsRelevant,
    jobsExcluded,
    failedSources,
    summary,
    currentCompany: (meta.company as string) || null,
    currentAts: (meta.ats as string) || null,
    queuePosition: job.status === "pending" ? queuePosition : null,
    estimatedSecondsRemaining: null,
    logs: auditLogs.slice(0, 10).map((l) => ({
      time: l.createdAt.toISOString(),
      level: l.level,
      message: l.message,
    })),
    error: job.error,
    startedAt: job.startedAt?.toISOString() ?? null,
    claimedAt: job.claimedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    stalled: heartbeatStale || claimedStale,
    result: meta,
  };
}
