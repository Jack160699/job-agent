import prisma from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isGoogleConnected } from "@/lib/google/oauth";
import {
  canUseFeature,
  getUserPlan,
  PLAN_LIMITS,
  type EntitlementFeature,
} from "@/lib/entitlements";
import {
  buildRecommendationCandidates,
  prioritizeRecommendations,
  type RecommendationSnapshot,
} from "@/lib/proactive/rules";
import { Prisma } from "@prisma/client";

export function isDeletedRecommendationOwnerError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2003") return false;
  const constraint = String(error.meta?.constraint ?? "");
  return constraint.includes("proactive_recommendations_user_id_fkey");
}

export function inQuietHours(
  start?: string | null,
  end?: string | null,
  now = new Date()
): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (
    !Number.isInteger(sh) ||
    !Number.isInteger(eh) ||
    sh < 0 ||
    sh > 23 ||
    eh < 0 ||
    eh > 23
  ) {
    return false;
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  const startM = sh * 60 + (sm || 0);
  const endM = eh * 60 + (em || 0);
  if (startM <= endM) return mins >= startM && mins < endM;
  return mins >= startM || mins < endM;
}

async function getUsageNearLimit(userId: string) {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const checks: Array<{
    feature: EntitlementFeature;
    limit: number;
  }> = [
    { feature: "job_search", limit: limits.jobSearchesPerMonth },
    {
      feature: "ai_consultant",
      limit: limits.aiConsultantMessagesPerDay,
    },
    { feature: "resume_tailor", limit: limits.resumeTailorsPerMonth },
    { feature: "application", limit: limits.applicationsPerMonth },
  ];

  const usage = await Promise.all(
    checks.map(async ({ feature, limit }) => ({
      feature,
      limit,
      ...(await canUseFeature(userId, feature)),
    }))
  );

  return usage
    .filter(
      (item) =>
        item.remaining !== undefined && item.remaining / item.limit <= 0.2
    )
    .sort(
      (a, b) =>
        (a.remaining ?? Number.MAX_SAFE_INTEGER) -
        (b.remaining ?? Number.MAX_SAFE_INTEGER)
    )[0];
}

export async function generateProactiveRecommendations(userId: string) {
  if (!isFeatureEnabled("proactiveAssistant")) return [];

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.notificationsEnabled) return [];

  if (inQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
    return [];
  }

  const now = new Date();
  const [
    masterResume,
    activeJobCount,
    strongMatches,
    newHighMatchCount,
    closingSoonCount,
    governmentDeadlineCount,
    lastSearch,
    pendingReviewCount,
    unreadRecruiterReplies,
    nextInterview,
    googleConnected,
    usageNearLimit,
  ] = await Promise.all([
    prisma.masterResume.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.job.count({ where: { userId, status: "ACTIVE" } }),
    prisma.job.findMany({
      where: {
        userId,
        status: "ACTIVE",
        matchScore: { gte: settings.matchThreshold },
      },
      orderBy: { matchScore: "desc" },
      take: 20,
      select: {
        title: true,
        company: true,
        matchScore: true,
      },
    }),
    prisma.job.count({
      where: {
        userId,
        status: "ACTIVE",
        matchScore: { gte: settings.matchThreshold },
        discoveredAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.job.count({
      where: {
        userId,
        status: "ACTIVE",
        closesAt: {
          gte: now,
          lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.job.count({
      where: {
        userId,
        status: "ACTIVE",
        closesAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        metadata: {
          path: ["jobType"],
          equals: "government",
        },
      },
    }),
    prisma.backgroundJob.findFirst({
      where: { userId, type: "SEARCH_JOBS", status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    prisma.application.count({
      where: { userId, status: "PENDING_REVIEW" },
    }),
    prisma.email.count({
      where: { userId, direction: "INBOUND", isRead: false },
    }),
    prisma.interview.findFirst({
      where: {
        userId,
        status: "SCHEDULED",
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        title: true,
        company: true,
        scheduledAt: true,
      },
    }),
    isGoogleConnected(userId),
    getUsageNearLimit(userId),
  ]);

  const expectsGoogleConnection =
    settings.gmailSyncEnabled ||
    settings.calendarSyncEnabled ||
    settings.sheetsSyncEnabled ||
    settings.driveBackupEnabled;
  const strongestMatch = strongMatches[0];
  const snapshot: RecommendationSnapshot = {
    preferencesComplete: settings.preferencesComplete,
    hasResume: Boolean(masterResume),
    activeJobCount,
    strongMatchCount: strongMatches.length,
    newHighMatchCount,
    closingSoonCount,
    governmentDeadlineCount,
    strongestMatch:
      strongestMatch?.matchScore != null
        ? {
            title: strongestMatch.title,
            company: strongestMatch.company,
            score: strongestMatch.matchScore,
          }
        : undefined,
    lastSearchAt: lastSearch?.completedAt ?? undefined,
    pendingReviewCount,
    unreadRecruiterReplies,
    nextInterview: nextInterview
      ? {
          ...nextInterview,
          company: nextInterview.company ?? undefined,
        }
      : undefined,
    integrationReconnectRequired:
      expectsGoogleConnection && !googleConnected,
    usageNearLimit:
      usageNearLimit?.remaining !== undefined
        ? {
            feature: usageNearLimit.feature,
            remaining: usageNearLimit.remaining,
            limit: usageNearLimit.limit,
          }
        : undefined,
  };
  const candidates = prioritizeRecommendations(
    buildRecommendationCandidates(snapshot, now),
    settings.disabledRecommendationCategories,
    5
  );
  const activeTypes = candidates.map((candidate) => candidate.type);

  await prisma.proactiveRecommendation.updateMany({
    where: {
      userId,
      status: "active",
      type: { notIn: activeTypes.length > 0 ? activeTypes : ["__none__"] },
    },
    data: { status: "expired" },
  });
  await prisma.proactiveRecommendation.updateMany({
    where: {
      userId,
      status: { in: ["active", "snoozed"] },
      expiresAt: { lte: now },
    },
    data: { status: "expired" },
  });

  const since = new Date(
    now.getTime() - settings.proactiveFrequencyHours * 60 * 60 * 1000
  );
  const created = [];
  for (const recommendation of candidates) {
    const existing = await prisma.proactiveRecommendation.findFirst({
      where: {
        userId,
        type: recommendation.type,
        status: { in: ["active", "snoozed"] },
        createdAt: { gte: since },
      },
    });
    if (existing) continue;

    try {
      const row = await prisma.proactiveRecommendation.create({
        data: {
          userId,
          ...recommendation,
          evidence: recommendation.evidence as unknown as Prisma.InputJsonValue,
        },
      });
      created.push(row);
    } catch (error) {
      // Account deletion can race a recommendation refresh after the session
      // and application user were resolved. Treat only that exact owner-FK
      // race as a completed cleanup, while preserving every other DB failure.
      if (isDeletedRecommendationOwnerError(error)) return created;
      throw error;
    }
  }

  return created;
}

export async function getActiveRecommendations(userId: string) {
  const now = new Date();
  const recommendations = await prisma.proactiveRecommendation.findMany({
    where: {
      userId,
      dismissed: false,
      status: { in: ["active", "snoozed"] },
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return recommendations.sort(
    (a, b) => (weight[b.priority] ?? 0) - (weight[a.priority] ?? 0)
  );
}
