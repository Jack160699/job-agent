import prisma from "@/lib/db";
import { extractJobSkills } from "@/lib/ai/job-analyzer";
import { calculateMatchScore } from "@/lib/ai/match-scorer";
import { tailorResume } from "@/lib/ai/resume-tailor";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { createAuditLog } from "@/lib/audit";
import type { JobSource, Prisma } from "@prisma/client";
import {
  buildDiscoveryBoards,
  evaluateJobAgainstPreferences,
  hasMinimumPreferences,
} from "./preferences";
import { updateJobProgress } from "./job-progress-store";
import { GreenhouseAdapter, LeverAdapter, AshbyAdapter, WorkdayAdapter } from "./adapters";
import type { DiscoveredJob } from "./types";
import { applyFeedbackProfile, buildFeedbackProfile } from "./feedback";

export async function getOrCreateUser(supabaseId: string, email: string) {
  let user = await prisma.user.findUnique({ where: { supabaseId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        supabaseId,
        email,
        settings: {
          create: {
            jobTitles: [],
            locations: [],
            enabledSources: [
              "LINKEDIN",
              "INDEED",
              "GREENHOUSE",
              "LEVER",
              "ASHBY",
            ],
          },
        },
      },
    });
    await createAuditLog({
      userId: user.id,
      action: "USER_CREATED",
      message: `New user registered: ${email}`,
      level: "AUDIT",
    });
  }
  return user;
}

export async function archiveLegacyJobs(userId: string) {
  const jobs = await prisma.job.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true, metadata: true },
  });

  const legacyIds = jobs
    .filter((j) => {
      const meta = j.metadata as Record<string, unknown> | null;
      return !meta?.preferenceFiltered;
    })
    .map((j) => j.id);

  if (legacyIds.length === 0) return 0;

  await prisma.job.updateMany({
    where: { id: { in: legacyIds } },
    data: {
      status: "ARCHIVED",
      metadata: { legacy: true, archivedAt: new Date().toISOString() },
    },
  });
  return legacyIds.length;
}

export async function searchJobs(userId: string, backgroundJobId?: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) throw new Error("User settings not found");

  if (!hasMinimumPreferences(settings)) {
    throw new Error("PREFERENCES_INCOMPLETE");
  }

  const feedbackProfile = buildFeedbackProfile(
    await prisma.jobFeedback.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        relevant: true,
        reason: true,
        job: { select: { title: true, company: true } },
      },
    })
  );

  const progress = async (stage: Parameters<typeof updateJobProgress>[1], meta?: Record<string, unknown>) => {
    if (backgroundJobId) {
      const active = await prisma.backgroundJob.findUnique({
        where: { id: backgroundJobId },
        select: { status: true },
      });
      if (active?.status === "cancelled") {
        throw new Error("JOB_CANCELLED");
      }
      await updateJobProgress(backgroundJobId, stage, meta);
    }
  };

  await progress("validating_preferences");
  await createAuditLog({
    userId,
    action: "JOB_SEARCH_VALIDATE",
    message: `Validated preferences: ${settings.jobTitles.join(", ")}`,
    level: "INFO",
  });

  const boards = buildDiscoveryBoards(settings);
  const filters = {
    titles: settings.jobTitles,
    locations: settings.locations,
    experienceYears: settings.experienceYears ?? undefined,
    skills: settings.requiredSkills,
    discoveryBoards: boards,
  };

  const adapters = [
    new GreenhouseAdapter(),
    new LeverAdapter(),
    new AshbyAdapter(),
    new WorkdayAdapter(),
  ];

  const defaultSources: JobSource[] = ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"];
  const enabled =
    settings.enabledSources?.length > 0 ? settings.enabledSources : defaultSources;

  await progress("discovering_sources", { boards });
  const discovered: DiscoveredJob[] = [];

  for (const adapter of adapters) {
    if (!enabled.includes(adapter.source as JobSource)) continue;
    try {
      await progress("fetching_jobs", { ats: adapter.source });
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_PROGRESS",
        message: `Fetching from ${adapter.name} (${adapter.source})…`,
        level: "INFO",
        metadata: { ats: adapter.source },
      });
      const jobs = await adapter.search(filters);
      discovered.push(...jobs);
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_ADAPTER_DONE",
        message: `Fetched ${jobs.length} jobs from ${adapter.name}`,
        level: "INFO",
        metadata: { ats: adapter.source, count: jobs.length },
      });
    } catch (error) {
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_ERROR",
        message: `Failed ${adapter.name}: ${error}`,
        level: "ERROR",
      });
    }
  }

  await progress("filtering", { rawCount: discovered.length });
  type ScoredJob = DiscoveredJob & {
    score: number;
    reasons: string[];
    analysis: ReturnType<typeof evaluateJobAgainstPreferences>;
  };
  const filtered: ScoredJob[] = [];
  const excluded: Array<{ title: string; company: string; reason: string; job: DiscoveredJob; analysis: ReturnType<typeof evaluateJobAgainstPreferences> }> = [];

  for (const job of discovered) {
    const result = applyFeedbackProfile(
      evaluateJobAgainstPreferences(job, settings),
      job,
      feedbackProfile,
      settings.matchThreshold
    );
    if (result.accepted) {
      filtered.push({ ...job, score: result.score, reasons: result.reasons, analysis: result });
    } else {
      excluded.push({
        title: job.title,
        company: job.company,
        reason: result.exclusions[0] || "Did not match preferences",
        job,
        analysis: result,
      });
    }
  }

  await progress("deduplicating", {
    filtered: filtered.length,
    excluded: excluded.length,
  });

  const seen = new Set<string>();
  const unique = filtered.filter((job) => {
    const key = `${job.source}:${job.externalId || job.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await progress("scoring", { unique: unique.length });
  let newCount = 0;
  let relevantCount = 0;

  for (const job of unique) {
    const existing = await prisma.job.findFirst({
      where: { userId, source: job.source, externalId: job.externalId },
    });
    if (existing) continue;

    await progress("saving", { title: job.title, company: job.company });

    await prisma.job.create({
      data: {
        userId,
        externalId: job.externalId,
        source: job.source,
        sourceUrl: job.sourceUrl,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        postedAt: job.postedAt,
        matchScore: job.score,
        matchAnalysis: {
          reasons: job.reasons,
          concerns: job.analysis.concerns,
          classification: job.analysis.classification,
          breakdown: job.analysis.breakdown,
          recommendation: job.analysis.recommendation,
          preferenceMatched: true,
        } as unknown as Prisma.InputJsonValue,
        metadata: {
          ...(job.metadata ?? {}),
          preferenceFiltered: true,
        } as unknown as Prisma.InputJsonValue,
        applications: {
          create: { userId, status: "DISCOVERED", matchScore: job.score },
        },
      },
    });
    newCount++;
    relevantCount++;
  }

  for (const ex of excluded.slice(0, 50)) {
    const existing = await prisma.job.findFirst({
      where: { userId, source: ex.job.source, externalId: ex.job.externalId },
    });
    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          matchScore: ex.analysis.score,
          matchAnalysis: {
            classification: ex.analysis.classification,
            exclusions: ex.analysis.exclusions,
            concerns: ex.analysis.concerns,
            breakdown: ex.analysis.breakdown,
            recommendation: ex.analysis.recommendation,
            excludedByPreferences: true,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    await prisma.job.create({
      data: {
        userId,
        externalId: ex.job.externalId,
        source: ex.job.source,
        sourceUrl: ex.job.sourceUrl,
        title: ex.job.title,
        company: ex.job.company,
        location: ex.job.location,
        description: ex.job.description,
        postedAt: ex.job.postedAt,
        status: "ARCHIVED",
        matchScore: ex.analysis.score,
        matchAnalysis: {
          classification: ex.analysis.classification,
          exclusions: ex.analysis.exclusions,
          concerns: ex.analysis.concerns,
          breakdown: ex.analysis.breakdown,
          recommendation: ex.analysis.recommendation,
          excludedByPreferences: true,
        } as unknown as Prisma.InputJsonValue,
        metadata: {
          excludedView: true,
          exclusionReason: ex.reason,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await progress("completed", {
    discovered: discovered.length,
    relevant: relevantCount,
    new: newCount,
    excluded: excluded.length,
  });

  await createAuditLog({
    userId,
    action: "JOB_SEARCH_COMPLETE",
    message: `Found ${discovered.length} raw, ${relevantCount} relevant, ${newCount} new (${excluded.length} excluded)`,
    level: "INFO",
    metadata: { excluded: excluded.slice(0, 10) },
  });

  return {
    total: discovered.length,
    relevant: relevantCount,
    new: newCount,
    excluded: excluded.length,
    excludedSample: excluded.slice(0, 5),
  };
}

export async function analyzeJob(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new Error("Job not found");

  const skills = await extractJobSkills(job.description);

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      requiredSkills: skills.requiredSkills,
      preferredSkills: skills.preferredSkills,
      experienceMin: skills.experienceMin,
      experienceMax: skills.experienceMax,
      workMode: skills.workMode,
      employmentType: skills.employmentType,
      visaSponsorship: skills.visaSponsorship,
      salaryMin: skills.salaryMin,
      salaryMax: skills.salaryMax,
      analyzedAt: new Date(),
    },
  });

  await prisma.application.updateMany({
    where: { jobId, userId },
    data: { status: "ANALYZED" },
  });

  return updatedJob;
}

export async function matchJob(userId: string, jobId: string) {
  const [job, masterResume, settings] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId } }),
    prisma.masterResume.findUnique({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  if (!job) throw new Error("Job not found");
  if (!masterResume) throw new Error("Master resume required for matching");

  const analysis = await calculateMatchScore({
    resumeSkills: masterResume.skills,
    resumeExperience: settings?.experienceYears ?? 0,
    resumeText: masterResume.rawText,
    jobTitle: job.title,
    jobDescription: job.description,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    location: job.location,
    workMode: job.workMode,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    userPreferences: {
      locations: settings?.locations,
      workModes: settings?.workModes,
      salaryMin: settings?.salaryMin,
      matchThreshold: settings?.matchThreshold,
    },
  });

  const threshold = settings?.matchThreshold ?? 70;
  const status =
    analysis.overallScore >= threshold
      ? "MATCHED"
      : analysis.recommendation === "SKIP"
        ? "SKIPPED"
        : "ANALYZED";

  await prisma.job.update({
    where: { id: jobId },
    data: {
      matchScore: analysis.overallScore,
      matchAnalysis: analysis as Prisma.InputJsonValue,
    },
  });

  await prisma.application.updateMany({
    where: { jobId, userId },
    data: { status, matchScore: analysis.overallScore },
  });

  return { analysis, status };
}

export async function processApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { job: true },
  });
  if (!application) throw new Error("Application not found");

  const masterResume = await prisma.masterResume.findUnique({
    where: { userId },
  });
  if (!masterResume) throw new Error("Master resume required");

  const job = application.job;
  const matchAnalysis = job.matchAnalysis as {
    matchedSkills?: string[];
    strengths?: string[];
  } | null;

  const tailored = await tailorResume({
    masterResume: {
      content: masterResume.content,
      rawText: masterResume.rawText,
      skills: masterResume.skills,
    },
    job: {
      title: job.title,
      company: job.company,
      description: job.description,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
    },
    matchAnalysis: matchAnalysis
      ? {
          matchedSkills: matchAnalysis.matchedSkills || [],
          strengths: matchAnalysis.strengths || [],
        }
      : undefined,
  });

  const coverLetter = await generateCoverLetter({
    resumeText: tailored.rawText,
    job: {
      title: job.title,
      company: job.company,
      description: job.description,
    },
    highlights: tailored.highlights,
  });

  const { generateResumePdf } = await import("@/lib/pdf/resume-pdf");
  const pdf = await generateResumePdf({
    title: tailored.title,
    rawText: tailored.rawText,
    skills: tailored.skills,
    highlights: tailored.highlights,
  });

  await prisma.tailoredResume.create({
    data: {
      userId,
      masterResumeId: masterResume.id,
      jobId: job.id,
      applicationId: application.id,
      title: tailored.title,
      content: tailored as Prisma.InputJsonValue,
      rawText: tailored.rawText,
      matchScore: application.matchScore,
      highlights: tailored.highlights,
      fileUrl: null,
    },
  });

  const tailoredResume = await prisma.tailoredResume.findFirst({
    where: { applicationId: application.id },
    orderBy: { createdAt: "desc" },
  });

  await prisma.coverLetter.create({
    data: {
      userId,
      jobId: job.id,
      applicationId: application.id,
      title: coverLetter.title,
      content: coverLetter.content,
      tone: coverLetter.tone,
    },
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const newStatus =
    settings?.requireReview !== false ? "PENDING_REVIEW" : "RESUME_GENERATED";

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: newStatus },
  });

  await createAuditLog({
    userId,
    action: "APPLICATION_PROCESSED",
    resource: "application",
    resourceId: applicationId,
    message: `Generated resume and cover letter for ${job.title} at ${job.company}`,
    level: "AUDIT",
  });

  return { tailoredResume, coverLetter, status: newStatus };
}

export async function runFullPipeline(userId: string, jobId: string) {
  await analyzeJob(userId, jobId);
  const { status } = await matchJob(userId, jobId);

  if (status === "MATCHED") {
    const application = await prisma.application.findFirst({
      where: { userId, jobId },
    });
    if (application) {
      return processApplication(userId, application.id);
    }
  }

  return { status };
}
