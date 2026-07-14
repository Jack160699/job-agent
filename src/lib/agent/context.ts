import prisma from "@/lib/db";

export async function buildUserContext(userId: string): Promise<string> {
  const [settings, onboarding, jobCount, appCount, lastSearch, pendingReview] =
    await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.onboardingState.findUnique({ where: { userId } }),
      prisma.job.count({ where: { userId, status: "ACTIVE" } }),
      prisma.application.count({ where: { userId } }),
      prisma.backgroundJob.findFirst({
        where: { userId, type: "SEARCH_JOBS", status: "completed" },
        orderBy: { completedAt: "desc" },
      }),
      prisma.application.count({
        where: { userId, status: "PENDING_REVIEW" },
      }),
    ]);

  const parts = [
    `Preferences complete: ${settings?.preferencesComplete ?? false}`,
    `Job titles: ${settings?.jobTitles?.join(", ") || "not set"}`,
    `Locations: ${settings?.locations?.join(", ") || "not set"}`,
    `Active saved jobs: ${jobCount}`,
    `Applications: ${appCount}`,
    `Pending review: ${pendingReview}`,
    `Onboarding complete: ${onboarding?.isComplete ?? false}`,
  ];

  if (lastSearch?.completedAt) {
    const meta = lastSearch.progressMeta as { relevant?: number } | null;
    parts.push(
      `Last search: ${lastSearch.completedAt.toISOString()} (${meta?.relevant ?? 0} relevant)`
    );
  }

  return parts.join("\n");
}

export function pageSuggestions(pathname?: string): string[] {
  if (!pathname) return ["What should I do next?", "How is my job search going?"];
  if (pathname.includes("/jobs")) {
    return ["Why aren't my results relevant?", "How do I import a job link?"];
  }
  if (pathname.includes("/applications")) {
    return ["Which applications need my review?", "What does pending review mean?"];
  }
  if (pathname.includes("/resumes")) {
    return ["How do I improve my resume for ATS?", "What skills am I missing?"];
  }
  if (pathname.includes("/settings")) {
    return ["Are my salary filters too strict?", "How do I connect Google?"];
  }
  if (pathname.includes("/onboarding")) {
    return ["What happens after onboarding?", "Can I change my target roles?"];
  }
  return ["Summarize my career progress", "What should I focus on today?"];
}
