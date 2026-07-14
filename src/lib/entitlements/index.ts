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

export type PlanName = keyof typeof PLAN_LIMITS;

export type EntitlementFeature =
  | "job_search"
  | "ai_consultant"
  | "resume_tailor"
  | "application";

export class EntitlementError extends Error {
  readonly code = "ENTITLEMENT_LIMIT" as const;
  readonly remaining: number;
  readonly feature: EntitlementFeature;

  constructor(
    feature: EntitlementFeature,
    message: string,
    remaining = 0
  ) {
    super(message);
    this.name = "EntitlementError";
    this.feature = feature;
    this.remaining = remaining;
  }
}

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getUserPlan(userId: string): Promise<PlanName> {
  const { default: prisma } = await import("@/lib/db");
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return "FREE";
  if (sub.status !== "ACTIVE" && sub.status !== "TRIALING") return "FREE";
  return sub.plan;
}

export async function recordUsage(
  userId: string,
  feature: EntitlementFeature,
  quantity = 1,
  metadata?: { idempotencyKey?: string }
) {
  const { default: prisma } = await import("@/lib/db");
  if (metadata?.idempotencyKey) {
    const existing = await prisma.usageLedger.findFirst({
      where: {
        userId,
        feature,
        metadata: {
          path: ["idempotencyKey"],
          equals: metadata.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  return prisma.usageLedger.create({
    data: {
      userId,
      feature,
      quantity,
      ...(metadata
        ? { metadata: metadata as object }
        : {}),
    },
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
): Promise<{ allowed: boolean; reason?: string; remaining?: number; plan: PlanName }> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const now = new Date();

  let limit = 0;
  let since = startOfUtcMonth(now);

  switch (feature) {
    case "job_search":
      limit = limits.jobSearchesPerMonth;
      since = startOfUtcMonth(now);
      break;
    case "ai_consultant":
      limit = limits.aiConsultantMessagesPerDay;
      since = startOfUtcDay(now);
      break;
    case "resume_tailor":
      limit = limits.resumeTailorsPerMonth;
      since = startOfUtcMonth(now);
      break;
    case "application":
      limit = limits.applicationsPerMonth;
      since = startOfUtcMonth(now);
      break;
  }

  const used = await getUsageCount(userId, feature, since);
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      reason: `You've reached your ${plan} plan limit for ${feature.replace(/_/g, " ")}.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining, plan };
}

export async function assertCanUseFeature(
  userId: string,
  feature: EntitlementFeature
) {
  const gate = await canUseFeature(userId, feature);
  if (!gate.allowed) {
    throw new EntitlementError(
      feature,
      gate.reason || "Usage limit reached",
      gate.remaining ?? 0
    );
  }
  return gate;
}

export async function consumeFeature(
  userId: string,
  feature: EntitlementFeature,
  options?: { idempotencyKey?: string }
) {
  const gate = await assertCanUseFeature(userId, feature);
  await recordUsage(userId, feature, 1, {
    idempotencyKey: options?.idempotencyKey,
  });
  return gate;
}

export async function ensureSubscription(userId: string) {
  const { default: prisma } = await import("@/lib/db");
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.subscription.create({
    data: { userId, plan: "FREE", status: "ACTIVE" },
  });
}
