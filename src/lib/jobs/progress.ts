import prisma from "@/lib/db";

export type JobRunStage =
  | "queued"
  | "starting"
  | "searching"
  | "analyzing"
  | "matching"
  | "tailoring"
  | "cover_letter"
  | "submitting"
  | "syncing"
  | "completed"
  | "failed";

export interface JobRunProgress {
  jobId: string | null;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  stage: JobRunStage;
  stageLabel: string;
  progress: number;
  jobsFound: number;
  jobsNew: number;
  currentCompany: string | null;
  currentAts: string | null;
  queuePosition: number | null;
  estimatedSecondsRemaining: number | null;
  logs: Array<{ time: string; level: string; message: string }>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
}

const STAGE_LABELS: Record<JobRunStage, string> = {
  queued: "Waiting in queue",
  starting: "Initializing agent",
  searching: "Searching job boards",
  analyzing: "Analyzing job descriptions",
  matching: "Scoring matches",
  tailoring: "Tailoring resume",
  cover_letter: "Generating cover letter",
  submitting: "Submitting applications",
  syncing: "Syncing integrations",
  completed: "Complete",
  failed: "Failed",
};

function inferStageFromAction(action: string, message: string): JobRunStage | null {
  const text = `${action} ${message}`.toLowerCase();
  if (text.includes("search") || text.includes("discover")) return "searching";
  if (text.includes("analyz")) return "analyzing";
  if (text.includes("match")) return "matching";
  if (text.includes("tailor") || text.includes("resume")) return "tailoring";
  if (text.includes("cover")) return "cover_letter";
  if (text.includes("submit") || text.includes("browser")) return "submitting";
  if (text.includes("sync") || text.includes("gmail") || text.includes("sheet")) return "syncing";
  if (text.includes("error") || text.includes("fail")) return "failed";
  if (text.includes("complete")) return "completed";
  return null;
}

function parseCompanyFromMessage(message: string): string | null {
  const match = message.match(/(?:at|from|searching)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-–—]|$|,|\.)/);
  return match?.[1]?.trim() ?? null;
}

function parseAtsFromMessage(message: string): string | null {
  const sources = ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY", "LINKEDIN", "INDEED"];
  const upper = message.toUpperCase();
  for (const s of sources) {
    if (upper.includes(s)) return s;
  }
  const lower = message.toLowerCase();
  if (lower.includes("greenhouse")) return "GREENHOUSE";
  if (lower.includes("lever")) return "LEVER";
  if (lower.includes("ashby")) return "ASHBY";
  if (lower.includes("workday")) return "WORKDAY";
  return null;
}

export async function getJobRunProgress(
  userId: string,
  type?: "SEARCH_JOBS" | "RUN_AGENT"
): Promise<JobRunProgress | null> {
  const jobTypes = type ? [type] : ["SEARCH_JOBS", "RUN_AGENT"];

  const recentJobs = await prisma.backgroundJob.findMany({
    where: { type: { in: jobTypes } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const latestJob = recentJobs.find((j) => {
    const payload = (j.payload as { userId?: string }) || {};
    return payload.userId === userId;
  });

  if (!latestJob) return null;

  const [pendingAhead, auditLogs] = await Promise.all([
    prisma.backgroundJob.count({
      where: {
        status: "pending",
        scheduledAt: { lte: new Date() },
        createdAt: { lt: latestJob.createdAt },
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return buildProgress(latestJob, pendingAhead, auditLogs);
}

function buildProgress(
  job: {
    id: string;
    type: string;
    status: string;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    payload: unknown;
  },
  queuePosition: number,
  auditLogs: Array<{
    level: string;
    action: string;
    message: string;
    createdAt: Date;
    metadata: unknown;
  }>
): JobRunProgress {
  const relevantLogs = auditLogs.filter((log) => {
    const since = job.startedAt ?? job.createdAt;
    return log.createdAt >= since;
  });

  let stage: JobRunStage = "queued";
  let jobsFound = 0;
  let jobsNew = 0;
  let currentCompany: string | null = null;
  let currentAts: string | null = null;

  for (const log of [...relevantLogs].reverse()) {
    const inferred = inferStageFromAction(log.action, log.message);
    if (inferred) stage = inferred;

    const discoverMatch = log.message.match(/Discovered (\d+) jobs?, (\d+) new/);
    if (discoverMatch) {
      jobsFound = parseInt(discoverMatch[1], 10);
      jobsNew = parseInt(discoverMatch[2], 10);
    }

    const company = parseCompanyFromMessage(log.message);
    if (company) currentCompany = company;

    const ats = parseAtsFromMessage(log.message);
    if (ats) currentAts = ats;
  }

  if (job.status === "pending") stage = "queued";
  else if (job.status === "running" && stage === "queued") stage = "starting";
  else if (job.status === "completed") stage = "completed";
  else if (job.status === "failed") stage = "failed";

  const stageOrder: JobRunStage[] = [
    "queued", "starting", "searching", "analyzing", "matching",
    "tailoring", "cover_letter", "submitting", "syncing", "completed",
  ];
  const stageIndex = stageOrder.indexOf(stage);
  const progress =
    job.status === "completed"
      ? 100
      : job.status === "failed"
        ? Math.max(5, (stageIndex / (stageOrder.length - 1)) * 100)
        : Math.min(95, Math.max(5, (stageIndex / (stageOrder.length - 1)) * 100));

  let estimatedSecondsRemaining: number | null = null;
  if (job.status === "running" && job.startedAt) {
    const elapsed = (Date.now() - job.startedAt.getTime()) / 1000;
    if (progress > 5) {
      estimatedSecondsRemaining = Math.round((elapsed / progress) * (100 - progress));
    }
  }

  const metadata = job.payload as Record<string, unknown> | null;

  return {
    jobId: job.id,
    type: job.type,
    status: job.status as JobRunProgress["status"],
    stage,
    stageLabel: STAGE_LABELS[stage],
    progress: Math.round(progress),
    jobsFound,
    jobsNew,
    currentCompany,
    currentAts,
    queuePosition: job.status === "pending" ? queuePosition : null,
    estimatedSecondsRemaining,
    logs: relevantLogs.slice(0, 15).map((l) => ({
      time: l.createdAt.toISOString(),
      level: l.level,
      message: l.message,
    })),
    error: job.error,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    result: (metadata?.result as Record<string, unknown> | undefined) ?? null,
  };
}
