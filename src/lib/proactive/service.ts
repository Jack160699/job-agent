import prisma from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";

function inQuietHours(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const startM = sh * 60 + (sm || 0);
  const endM = eh * 60 + (em || 0);
  if (startM <= endM) return mins >= startM && mins < endM;
  return mins >= startM || mins < endM;
}

export async function generateProactiveRecommendations(userId: string) {
  if (!isFeatureEnabled("proactiveAssistant")) return [];

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.notificationsEnabled) return [];

  if (inQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
    return [];
  }

  const since = new Date(Date.now() - settings.proactiveFrequencyHours * 60 * 60 * 1000);
  const recent = await prisma.proactiveRecommendation.findFirst({
    where: { userId, createdAt: { gte: since }, dismissed: false },
  });
  if (recent) return [];

  const recommendations: Array<{
    type: string;
    title: string;
    body: string;
    reason: string;
    actionUrl?: string;
  }> = [];

  if (!settings.preferencesComplete) {
    recommendations.push({
      type: "onboarding",
      title: "Complete your search preferences",
      body: "Kairela needs your job titles, skills, and locations to find relevant roles.",
      reason: "Preferences are incomplete — searches may return poor matches.",
      actionUrl: "/dashboard/onboarding",
    });
  }

  const jobCount = await prisma.job.count({
    where: { userId, status: "ACTIVE" },
  });
  if (settings.preferencesComplete && jobCount === 0) {
    recommendations.push({
      type: "search",
      title: "Run your first job search",
      body: "Your preferences are set. Start a search to discover matching opportunities.",
      reason: "No active jobs in your pipeline yet.",
      actionUrl: "/dashboard/jobs",
    });
  }

  const pendingReview = await prisma.application.count({
    where: { userId, status: "PENDING_REVIEW" },
  });
  if (pendingReview > 0) {
    recommendations.push({
      type: "applications",
      title: `${pendingReview} application${pendingReview > 1 ? "s" : ""} ready for review`,
      body: "Review tailored materials before submission.",
      reason: "Applications are prepared and waiting for your approval.",
      actionUrl: "/dashboard/applications",
    });
  }

  const created = [];
  for (const rec of recommendations.slice(0, 2)) {
    const existing = await prisma.proactiveRecommendation.findFirst({
      where: {
        userId,
        type: rec.type,
        dismissed: false,
        createdAt: { gte: since },
      },
    });
    if (existing) continue;

    const row = await prisma.proactiveRecommendation.create({
      data: { userId, ...rec },
    });
    created.push(row);
  }

  return created;
}

export async function getActiveRecommendations(userId: string) {
  const now = new Date();
  return prisma.proactiveRecommendation.findMany({
    where: {
      userId,
      dismissed: false,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
