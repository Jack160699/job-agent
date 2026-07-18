import prisma from "@/lib/db";
import { getDbUser } from "@/lib/auth/server";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("Database query failed:", error);
    return fallback;
  }
}

export async function getDashboardStats() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) {
      return {
        activeJobs: 0,
        strongMatches: 0,
        applications: 0,
        pendingReview: 0,
        interviews: 0,
      };
    }

    const [activeJobs, strongMatches, applications, pendingReview, interviews] =
      await Promise.all([
        prisma.job.count({ where: { userId: user.id, status: "ACTIVE" } }),
        prisma.job.count({
          where: { userId: user.id, matchScore: { gte: 80 } },
        }),
        prisma.application.count({ where: { userId: user.id } }),
        prisma.application.count({
          where: { userId: user.id, status: "PENDING_REVIEW" },
        }),
        prisma.interview.count({
          where: {
            userId: user.id,
            status: "SCHEDULED",
            scheduledAt: { gte: new Date() },
          },
        }),
      ]);

    return { activeJobs, strongMatches, applications, pendingReview, interviews };
  }, {
    activeJobs: 0,
    strongMatches: 0,
    applications: 0,
    pendingReview: 0,
    interviews: 0,
  });
}

export async function getRecentApplications(limit = 5) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.application.findMany({
      where: { userId: user.id },
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: { job: true },
    });
  }, []);
}

export async function getUpcomingInterviews(limit = 3) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.interview.findMany({
      where: {
        userId: user.id,
        scheduledAt: { gte: new Date() },
        status: "SCHEDULED",
      },
      take: limit,
      orderBy: { scheduledAt: "asc" },
    });
  }, []);
}

export async function getJobs(filters?: {
  status?: string;
  minScore?: number;
  source?: string;
}) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.job.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        ...(filters?.minScore ? { matchScore: { gte: filters.minScore } } : {}),
        ...(filters?.source ? { source: filters.source as "LINKEDIN" } : {}),
      },
      orderBy: { discoveredAt: "desc" },
      include: {
        applications: true,
        feedback: { where: { userId: user.id }, take: 1 },
      },
    });
  }, []);
}

export type JobResultsView =
  | "recommended"
  | "possible"
  | "saved"
  | "imported"
  | "excluded"
  | "expired";

export async function getJobsForView(view: JobResultsView) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];

    let where;
    if (view === "expired") {
      where = { userId: user.id, status: "EXPIRED" as const };
    } else if (view === "excluded") {
      where = { userId: user.id, status: "ARCHIVED" as const };
    } else if (view === "saved") {
      where = {
        userId: user.id,
        savedAt: { not: null },
      };
    } else if (view === "imported") {
      where = {
        userId: user.id,
        status: "ACTIVE" as const,
        imports: { some: { userId: user.id } },
      };
    } else if (view === "recommended") {
      where = {
        userId: user.id,
        status: "ACTIVE" as const,
        matchAnalysis: { path: ["classification"], equals: "STRONG" },
      };
    } else {
      // "possible" browse view — keep LOW out of this tab.
      where = {
        userId: user.id,
        status: "ACTIVE" as const,
        matchAnalysis: { path: ["classification"], equals: "POSSIBLE" },
      };
    }

    // Card-summary fields only (Phase 2 performance budget): the job list
    // view never renders full tailored-resume/cover-letter bodies, so we
    // only need to know whether they exist (for a "documents ready" badge),
    // not their content. Detailed relations load only when a job's drawer
    // or detail page is opened (see getJobDetail below).
    return prisma.job.findMany({
      where,
      orderBy:
        view === "recommended" || view === "possible"
          ? [{ matchScore: "desc" }, { discoveredAt: "desc" }]
          : { discoveredAt: "desc" },
      take: 20,
      include: {
        applications: {
          select: {
            id: true,
            status: true,
            matchScore: true,
            failureReason: true,
            tailoredResume: { select: { id: true } },
            coverLetter: { select: { id: true } },
          },
        },
        imports: { select: { id: true } },
        feedback: { where: { userId: user.id }, take: 1 },
        provenance: { select: { id: true, source: true } },
      },
    });
  }, []);
}

/** Full relations for a single job — used by the job drawer/detail view only. */
export async function getJobDetail(jobId: string) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return null;
    return prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      include: {
        applications: {
          include: { tailoredResume: true, coverLetter: true, scoreRecord: true },
        },
        imports: true,
        feedback: { where: { userId: user.id }, take: 1 },
        provenance: true,
        // Phase D: before/after Kairela Job ATS Match history for this job.
        scoreRecords: { orderBy: { createdAt: "desc" } },
      },
    });
  }, null);
}

export async function getExcludedJobs() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.job.findMany({
      where: {
        userId: user.id,
        status: "ARCHIVED",
        matchAnalysis: { path: ["excludedByPreferences"], equals: true },
      },
      orderBy: { discoveredAt: "desc" },
      take: 100,
      include: {
        applications: true,
        feedback: { where: { userId: user.id }, take: 1 },
      },
    });
  }, []);
}

export async function getApplications(status?: string) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.application.findMany({
      where: {
        userId: user.id,
        ...(status ? { status: status as "SUBMITTED" } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        job: true,
        tailoredResume: true,
        coverLetter: true,
        // Phase D: before/after Kairela Job ATS Match history, surfaced on
        // the Applications list and Application detail views.
        scoreRecord: true,
      },
    });
  }, []);
}

export async function getMasterResume() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return null;
    return prisma.masterResume.findUnique({ where: { userId: user.id } });
  }, null);
}

export async function getCoverLetters() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.coverLetter.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { job: true },
    });
  }, []);
}

export async function getTailoredResumes() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.tailoredResume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { job: true },
    });
  }, []);
}

export async function getResumeHistory() {
  try {
    const user = await getDbUser();
    if (!user) {
      return {
        master: null,
        masterVersions: [],
        tailored: [],
        error: null,
      };
    }

    const [master, masterVersions, tailored] = await Promise.all([
      prisma.masterResume.findUnique({ where: { userId: user.id } }),
      prisma.masterResumeVersion.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.tailoredResume.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          job: { select: { id: true, title: true, company: true } },
          application: { select: { id: true, status: true } },
          versions: { orderBy: { version: "desc" }, take: 50 },
          // Phase D: before/after Kairela Job ATS Match score, surfaced in
          // Resume History alongside the tailored document it was scored for.
          scoreRecords: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    ]);

    return { master, masterVersions, tailored, error: null };
  } catch (error) {
    console.error("Resume history query failed:", error);
    return {
      master: null,
      masterVersions: [],
      tailored: [],
      error: "Resume history could not be loaded.",
    };
  }
}

export async function getEmails() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.email.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: "desc" },
      take: 50,
      include: { recruiter: true, application: { include: { job: true } } },
    });
  }, []);
}

export async function getInterviews() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.interview.findMany({
      where: { userId: user.id },
      orderBy: { scheduledAt: "asc" },
      include: { application: { include: { job: true } } },
    });
  }, []);
}

export async function getAuditLogs(limit = 100) {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return [];
    return prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }, []);
}

export async function getUserSettings() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) return null;
    return prisma.userSettings.findUnique({ where: { userId: user.id } });
  }, null);
}

export async function getAnalytics() {
  return safe(async () => {
    const user = await getDbUser();
    if (!user) {
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

    const [
      totalJobs,
      totalApplications,
      submitted,
      interviewing,
      offered,
      rejected,
      avgMatchScore,
    ] = await Promise.all([
      prisma.job.count({ where: { userId: user.id } }),
      prisma.application.count({ where: { userId: user.id } }),
      prisma.application.count({
        where: { userId: user.id, status: "SUBMITTED" },
      }),
      prisma.application.count({
        where: { userId: user.id, status: "INTERVIEWING" },
      }),
      prisma.application.count({
        where: { userId: user.id, status: "OFFERED" },
      }),
      prisma.application.count({
        where: { userId: user.id, status: "REJECTED" },
      }),
      prisma.job.aggregate({
        where: { userId: user.id },
        _avg: { matchScore: true },
      }),
    ]);

    const sourceBreakdown = await prisma.job.groupBy({
      by: ["source"],
      where: { userId: user.id },
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
  }, {
    totalJobs: 0,
    totalApplications: 0,
    submitted: 0,
    interviewing: 0,
    offered: 0,
    rejected: 0,
    avgMatchScore: 0,
    sourceBreakdown: [],
    conversionRate: 0,
  });
}
