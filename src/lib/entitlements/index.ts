export const PLAN_LIMITS = {
  FREE: {
    jobSearchesPerMonth: 10,
    aiConsultantMessagesPerDay: 20,
    resumeTailorsPerMonth: 5,
    applicationsPerMonth: 25,
  },
  PRO: {
    jobSearchesPerMonth: 100,
    aiConsultantMessagesPerDay: 200,
    resumeTailorsPerMonth: 50,
    applicationsPerMonth: 200,
  },
  TEAM: {
    jobSearchesPerMonth: 500,
    aiConsultantMessagesPerDay: 1000,
    resumeTailorsPerMonth: 200,
    applicationsPerMonth: 1000,
  },
} as const;

export type EntitlementFeature =
  | "job_search"
  | "ai_consultant"
  | "resume_tailor"
  | "application";

export async function getUserPlan(userId: string) {
  const { default: prisma } = await import("@/lib/db");
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.plan ?? "FREE";
}

export async function recordUsage(
  userId: string,
  feature: EntitlementFeature,
  quantity = 1
) {
  const { default: prisma } = await import("@/lib/db");
  await prisma.usageLedger.create({
    data: { userId, feature, quantity },
  });
}

export async function getUsageCount(
  userId: string,
  feature: EntitlementFeature,
  since: Date
) {
  const { default: prisma } = await import("@/lib/db");
  const result = await prisma.usageLedger.aggregate({
    where: { userId, feature, createdAt: { gte: since } },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function canUseFeature(
  userId: string,
  feature: EntitlementFeature
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let limit = 0;
  let since = monthStart;

  switch (feature) {
    case "job_search":
      limit = limits.jobSearchesPerMonth;
      since = monthStart;
      break;
    case "ai_consultant":
      limit = limits.aiConsultantMessagesPerDay;
      since = dayStart;
      break;
    case "resume_tailor":
      limit = limits.resumeTailorsPerMonth;
      since = monthStart;
      break;
    case "application":
      limit = limits.applicationsPerMonth;
      since = monthStart;
      break;
  }

  const used = await getUsageCount(userId, feature, since);
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason: `You've reached your ${plan} plan limit for ${feature.replace("_", " ")}.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

export async function ensureSubscription(userId: string) {
  const { default: prisma } = await import("@/lib/db");
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.subscription.create({
    data: { userId, plan: "FREE", status: "ACTIVE" },
  });
}
