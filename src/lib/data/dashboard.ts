import prisma from "@/lib/db";

const DEMO_USER_ID = "demo-user";

export async function getDashboardStats() {
  try {
    const [activeJobs, strongMatches, applications, pendingReview, interviews] =
      await Promise.all([
        prisma.job.count({ where: { status: "ACTIVE" } }),
        prisma.job.count({ where: { matchScore: { gte: 80 } } }),
        prisma.application.count(),
        prisma.application.count({ where: { status: "PENDING_REVIEW" } }),
        prisma.interview.count({
          where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
        }),
      ]);

    return { activeJobs, strongMatches, applications, pendingReview, interviews };
  } catch {
    return {
      activeJobs: 0,
      strongMatches: 0,
      applications: 0,
      pendingReview: 0,
      interviews: 0,
    };
  }
}

export async function getRecentApplications(limit = 5) {
  try {
    return prisma.application.findMany({
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { job: true },
    });
  } catch {
    return [];
  }
}

export async function getUpcomingInterviews(limit = 3) {
  try {
    return prisma.interview.findMany({
      where: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
      take: limit,
      orderBy: { scheduledAt: "asc" },
    });
  } catch {
    return [];
  }
}

export async function getJobs(filters?: {
  status?: string;
  minScore?: number;
  source?: string;
}) {
  try {
    return prisma.job.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as "ACTIVE" } : {}),
        ...(filters?.minScore ? { matchScore: { gte: filters.minScore } } : {}),
        ...(filters?.source ? { source: filters.source as "LINKEDIN" } : {}),
      },
      orderBy: { discoveredAt: "desc" },
      include: { applications: true },
    });
  } catch {
    return [];
  }
}

export async function getApplications(status?: string) {
  try {
    return prisma.application.findMany({
      where: status ? { status: status as "SUBMITTED" } : {},
      orderBy: { updatedAt: "desc" },
      include: {
        job: true,
        tailoredResume: true,
        coverLetter: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getMasterResume() {
  try {
    return prisma.masterResume.findFirst();
  } catch {
    return null;
  }
}

export async function getCoverLetters() {
  try {
    return prisma.coverLetter.findMany({
      orderBy: { createdAt: "desc" },
      include: { job: true },
    });
  } catch {
    return [];
  }
}

export async function getTailoredResumes() {
  try {
    return prisma.tailoredResume.findMany({
      orderBy: { createdAt: "desc" },
      include: { job: true },
    });
  } catch {
    return [];
  }
}

export async function getEmails() {
  try {
    return prisma.email.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
      include: { recruiter: true, application: { include: { job: true } } },
    });
  } catch {
    return [];
  }
}

export async function getInterviews() {
  try {
    return prisma.interview.findMany({
      orderBy: { scheduledAt: "asc" },
      include: { application: { include: { job: true } } },
    });
  } catch {
    return [];
  }
}

export async function getAuditLogs(limit = 100) {
  try {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getUserSettings() {
  try {
    return prisma.userSettings.findFirst();
  } catch {
    return null;
  }
}

export async function getAnalytics() {
  try {
    const [
      totalJobs,
      totalApplications,
      submitted,
      interviewing,
      offered,
      rejected,
      avgMatchScore,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.application.count(),
      prisma.application.count({ where: { status: "SUBMITTED" } }),
      prisma.application.count({ where: { status: "INTERVIEWING" } }),
      prisma.application.count({ where: { status: "OFFERED" } }),
      prisma.application.count({ where: { status: "REJECTED" } }),
      prisma.job.aggregate({ _avg: { matchScore: true } }),
    ]);

    const sourceBreakdown = await prisma.job.groupBy({
      by: ["source"],
      _count: true,
    });

    return {
      totalJobs,
      totalApplications,
      submitted,
      interviewing,
      offered,
      rejected,
      avgMatchScore: avgMatchScore._avg.matchScore ?? 0,
      sourceBreakdown,
      conversionRate:
        totalApplications > 0
          ? Math.round((submitted / totalApplications) * 100)
          : 0,
    };
  } catch {
    return {
      totalJobs: 0,
      totalApplications: 0,
      submitted: 0,
      interviewing: 0,
      offered: 0,
      rejected: 0,
      avgMatchScore: 0,
      sourceBreakdown: [],
      conversionRate: 0,
    };
  }
}

export { DEMO_USER_ID };
