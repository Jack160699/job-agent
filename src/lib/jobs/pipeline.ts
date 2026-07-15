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
import { buildUserSearchPlan } from "./search-plan";
import {
  deduplicateJobs,
  type DeduplicatedJob,
} from "./deduplication";
import {
  shouldTemporarilyDisableSource,
  type SourceFetchResult,
} from "./source-health";
import {
  assertCanUseFeature,
  consumeFeature,
  recordUsage,
} from "@/lib/entitlements";

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
        job: {
          select: {
            title: true,
            company: true,
            location: true,
            workMode: true,
            employmentType: true,
          },
        },
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

  await progress("validating_preferences", {
    label: "Building your search plan",
  });
  const searchPlan = buildUserSearchPlan(settings);
  const storedPlan = await prisma.searchPlan.create({
    data: {
      userId,
      version: searchPlan.version,
      plan: searchPlan as unknown as Prisma.InputJsonValue,
    },
  });
  await createAuditLog({
    userId,
    action: "JOB_SEARCH_VALIDATE",
    message: `Validated preferences: ${settings.jobTitles.join(", ")}`,
    level: "INFO",
    metadata: {
      searchPlanId: storedPlan.id,
      version: searchPlan.version,
      queries: searchPlan.queries.length,
    },
  });

  await consumeFeature(userId, "job_search", {
    idempotencyKey: backgroundJobId
      ? `job_search:${backgroundJobId}`
      : undefined,
  });

  const boards = buildDiscoveryBoards(settings);
  const filters = {
    titles: [...searchPlan.primaryRoles, ...searchPlan.alternativeRoles],
    queries: searchPlan.queries,
    locations: settings.locations,
    remote: settings.workModes.includes("REMOTE"),
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

  await progress("discovering_sources", {
    label: "Checking target companies",
    boards,
    searchPlanId: storedPlan.id,
  });
  const discovered: DiscoveredJob[] = [];
  const sourceResults: SourceFetchResult[] = [];

  for (const adapter of adapters) {
    if (!enabled.includes(adapter.source as JobSource)) continue;
    const currentHealth = await prisma.jobSourceHealth.findUnique({
      where: {
        userId_source: { userId, source: adapter.source as JobSource },
      },
    });
    const healthDecision = shouldTemporarilyDisableSource({
      requests: currentHealth?.requests ?? 0,
      successfulResponses: currentHealth?.successfulResponses ?? 0,
      emptyResponses: currentHealth?.emptyResponses ?? 0,
      invalidJobs: currentHealth?.invalidJobs ?? 0,
      duplicates: currentHealth?.duplicateJobs ?? 0,
      expiredJobs: currentHealth?.expiredJobs ?? 0,
      failures: currentHealth?.failures ?? 0,
      relevanceTotal: currentHealth?.relevanceTotal ?? 0,
      relevanceSamples: currentHealth?.relevanceSamples ?? 0,
      consecutiveFailures: currentHealth?.consecutiveFailures ?? 0,
      disabledUntil: currentHealth?.disabledUntil,
    });
    if (healthDecision.disabled) {
      sourceResults.push({
        source: adapter.source,
        requested: false,
        success: false,
        fetched: 0,
        invalid: 0,
        duplicates: 0,
        expired: 0,
        relevant: 0,
        error: healthDecision.reason,
      });
      continue;
    }
    try {
      await progress("fetching_jobs", {
        label: "Searching relevant sources",
        ats: adapter.source,
      });
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_PROGRESS",
        message: `Fetching from ${adapter.name} (${adapter.source})…`,
        level: "INFO",
        metadata: { ats: adapter.source },
      });
      const jobs = await adapter.search(filters);
      discovered.push(...jobs);
      sourceResults.push({
        source: adapter.source,
        requested: true,
        success: true,
        fetched: jobs.length,
        invalid: jobs.filter(
          (job) => !job.title || !job.company || !job.sourceUrl
        ).length,
        duplicates: 0,
        expired: 0,
        relevant: 0,
      });
      await prisma.jobSourceHealth.upsert({
        where: {
          userId_source: { userId, source: adapter.source as JobSource },
        },
        create: {
          userId,
          source: adapter.source as JobSource,
          requests: 1,
          successfulResponses: 1,
          emptyResponses: jobs.length === 0 ? 1 : 0,
          invalidJobs: jobs.filter(
            (job) => !job.title || !job.company || !job.sourceUrl
          ).length,
          lastSuccessfulFetch: new Date(),
        },
        update: {
          requests: { increment: 1 },
          successfulResponses: { increment: 1 },
          emptyResponses: jobs.length === 0 ? { increment: 1 } : undefined,
          invalidJobs: {
            increment: jobs.filter(
              (job) => !job.title || !job.company || !job.sourceUrl
            ).length,
          },
          consecutiveFailures: 0,
          lastSuccessfulFetch: new Date(),
          lastError: null,
          disabledUntil: null,
        },
      });
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_ADAPTER_DONE",
        message: `Fetched ${jobs.length} jobs from ${adapter.name}`,
        level: "INFO",
        metadata: { ats: adapter.source, count: jobs.length },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceResults.push({
        source: adapter.source,
        requested: true,
        success: false,
        fetched: 0,
        invalid: 0,
        duplicates: 0,
        expired: 0,
        relevant: 0,
        error: message,
      });
      await prisma.jobSourceHealth.upsert({
        where: {
          userId_source: { userId, source: adapter.source as JobSource },
        },
        create: {
          userId,
          source: adapter.source as JobSource,
          requests: 1,
          failures: 1,
          consecutiveFailures: 1,
          lastError: message,
        },
        update: {
          requests: { increment: 1 },
          failures: { increment: 1 },
          consecutiveFailures: { increment: 1 },
          lastError: message,
        },
      });
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_ERROR",
        message: `Failed ${adapter.name}: ${message}`,
        level: "ERROR",
      });
    }
  }

  await progress("deduplicating", {
    label: "Removing duplicates",
    rawCount: discovered.length,
  });
  const deduplicated = deduplicateJobs(
    discovered.filter(
      (job) => Boolean(job.title && job.company && job.sourceUrl)
    )
  );

  await progress("filtering", {
    label: "Evaluating requirements",
    rawCount: discovered.length,
    uniqueCount: deduplicated.jobs.length,
    duplicateCount: deduplicated.duplicateCount,
  });
  type ScoredJob = DiscoveredJob & {
    score: number;
    reasons: string[];
    analysis: ReturnType<typeof evaluateJobAgainstPreferences>;
    provenance: Array<{
      source: JobSource;
      sourceUrl: string;
      externalId?: string;
    }>;
    canonicalUrl: string;
    fingerprint: string;
  };
  const filtered: ScoredJob[] = [];
  const excluded: Array<{
    title: string;
    company: string;
    reason: string;
    job: DeduplicatedJob;
    analysis: ReturnType<typeof evaluateJobAgainstPreferences>;
  }> = [];

  for (const job of deduplicated.jobs) {
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

  await progress("scoring", {
    label: "Ranking opportunities",
    unique: filtered.length,
  });
  let newCount = 0;
  let relevantCount = 0;

  for (const job of filtered) {
    const existing = await prisma.job.findFirst({
      where: {
        userId,
        OR: [
          ...(job.externalId
            ? [{ source: job.source, externalId: job.externalId }]
            : []),
          { canonicalUrl: job.canonicalUrl },
          { descriptionFingerprint: job.fingerprint },
        ],
      },
    });
    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          matchScore: job.score,
          matchAnalysis: {
            reasons: job.reasons,
            concerns: job.analysis.concerns,
            uncertain: job.analysis.uncertain,
            exclusions: job.analysis.exclusions,
            classification: job.analysis.classification,
            classificationVersion: job.analysis.classificationVersion,
            breakdown: job.analysis.breakdown,
            recommendation: job.analysis.recommendation,
            preferenceMatched: true,
            searchPlanId: storedPlan.id,
          } as unknown as Prisma.InputJsonValue,
          removedAt: null,
        },
      });
      for (const provenance of job.provenance) {
        await prisma.jobProvenance.upsert({
          where: {
            userId_source_sourceUrl: {
              userId,
              source: provenance.source,
              sourceUrl: provenance.sourceUrl,
            },
          },
          create: {
            userId,
            jobId: existing.id,
            ...provenance,
          },
          update: {
            jobId: existing.id,
            externalId: provenance.externalId,
            lastSeenAt: new Date(),
          },
        });
      }
      relevantCount++;
      continue;
    }

    await progress("saving", {
      label: "Preparing results",
      title: job.title,
      company: job.company,
    });

    await prisma.job.create({
      data: {
        userId,
        externalId: job.externalId,
        source: job.source,
        sourceUrl: job.sourceUrl,
        canonicalUrl: job.canonicalUrl,
        descriptionFingerprint: job.fingerprint,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        postedAt: job.postedAt,
        closesAt: job.closesAt,
        removedAt: job.removedAt,
        workMode: job.workMode,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        visaSponsorship: job.visaSponsorship,
        matchScore: job.score,
        matchAnalysis: {
          reasons: job.reasons,
          concerns: job.analysis.concerns,
          uncertain: job.analysis.uncertain,
          exclusions: job.analysis.exclusions,
          classification: job.analysis.classification,
          classificationVersion: job.analysis.classificationVersion,
          breakdown: job.analysis.breakdown,
          recommendation: job.analysis.recommendation,
          preferenceMatched: true,
          searchPlanId: storedPlan.id,
        } as unknown as Prisma.InputJsonValue,
        metadata: {
          ...(job.metadata ?? {}),
          preferenceFiltered: true,
        } as unknown as Prisma.InputJsonValue,
        applications: {
          create: { userId, status: "DISCOVERED", matchScore: job.score },
        },
        provenance: {
          create: job.provenance.map((entry) => ({
            userId,
            ...entry,
          })),
        },
      },
    });
    newCount++;
    relevantCount++;
  }

  for (const ex of excluded.slice(0, 50)) {
    const existing = await prisma.job.findFirst({
      where: {
        userId,
        OR: [
          ...(ex.job.externalId
            ? [{ source: ex.job.source, externalId: ex.job.externalId }]
            : []),
          { canonicalUrl: ex.job.canonicalUrl },
          { descriptionFingerprint: ex.job.fingerprint },
        ],
      },
    });
    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          matchScore: ex.analysis.score,
          matchAnalysis: {
            classification: ex.analysis.classification,
            classificationVersion: ex.analysis.classificationVersion,
            exclusions: ex.analysis.exclusions,
            concerns: ex.analysis.concerns,
            uncertain: ex.analysis.uncertain,
            breakdown: ex.analysis.breakdown,
            recommendation: ex.analysis.recommendation,
            excludedByPreferences: true,
            searchPlanId: storedPlan.id,
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
        canonicalUrl: ex.job.canonicalUrl,
        descriptionFingerprint: ex.job.fingerprint,
        title: ex.job.title,
        company: ex.job.company,
        location: ex.job.location,
        description: ex.job.description,
        postedAt: ex.job.postedAt,
        closesAt: ex.job.closesAt,
        removedAt: ex.job.removedAt,
        workMode: ex.job.workMode,
        employmentType: ex.job.employmentType,
        salaryMin: ex.job.salaryMin,
        salaryMax: ex.job.salaryMax,
        salaryCurrency: ex.job.salaryCurrency,
        visaSponsorship: ex.job.visaSponsorship,
        status: "ARCHIVED",
        matchScore: ex.analysis.score,
        matchAnalysis: {
          classification: ex.analysis.classification,
          classificationVersion: ex.analysis.classificationVersion,
          exclusions: ex.analysis.exclusions,
          concerns: ex.analysis.concerns,
          uncertain: ex.analysis.uncertain,
          breakdown: ex.analysis.breakdown,
          recommendation: ex.analysis.recommendation,
          excludedByPreferences: true,
          searchPlanId: storedPlan.id,
        } as unknown as Prisma.InputJsonValue,
        metadata: {
          excludedView: true,
          exclusionReason: ex.reason,
        } as unknown as Prisma.InputJsonValue,
        provenance: {
          create: ex.job.provenance.map((entry) => ({
            userId,
            ...entry,
          })),
        },
      },
    });
  }

  const expiryCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const expiredExisting = await prisma.job.updateMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [
        { closesAt: { lt: new Date() } },
        { removedAt: { not: null } },
        { postedAt: { lt: expiryCutoff } },
      ],
    },
    data: { status: "EXPIRED" },
  });

  for (const sourceResult of sourceResults) {
    if (!sourceResult.success) continue;
    const sourceJobs = deduplicated.jobs.filter(
      (job) => job.source === sourceResult.source
    );
    const sourceRelevant = filtered.filter(
      (job) => job.source === sourceResult.source
    );
    const sourceExpired = excluded.filter(
      (entry) =>
        entry.job.source === sourceResult.source &&
        entry.analysis.recommendation.toLowerCase().includes("expired")
    );
    sourceResult.relevant = sourceRelevant.length;
    sourceResult.expired = sourceExpired.length;
    const averageRelevance =
      sourceRelevant.length > 0
        ? sourceRelevant.reduce((sum, job) => sum + job.score, 0) /
          sourceRelevant.length
        : 0;
    await prisma.jobSourceHealth.update({
      where: {
        userId_source: { userId, source: sourceResult.source },
      },
      data: {
        duplicateJobs: {
          increment: Math.max(0, sourceResult.fetched - sourceJobs.length),
        },
        expiredJobs: { increment: sourceExpired.length },
        relevanceTotal: { increment: averageRelevance },
        relevanceSamples: { increment: sourceRelevant.length > 0 ? 1 : 0 },
      },
    });
  }

  await progress("completed", {
    label: "Complete",
    discovered: discovered.length,
    relevant: relevantCount,
    new: newCount,
    excluded: excluded.length,
    duplicates: deduplicated.duplicateCount,
    expired: expiredExisting.count,
    sources: sourceResults,
    searchPlanId: storedPlan.id,
  });

  await createAuditLog({
    userId,
    action: "JOB_SEARCH_COMPLETE",
    message: `Found ${discovered.length} raw, ${relevantCount} relevant, ${newCount} new (${excluded.length} excluded)`,
    level: "INFO",
    metadata: {
      searchPlanId: storedPlan.id,
      duplicates: deduplicated.duplicateCount,
      expired: expiredExisting.count,
      sources: sourceResults,
      excluded: excluded.slice(0, 10),
    },
  });

  return {
    total: discovered.length,
    relevant: relevantCount,
    new: newCount,
    excluded: excluded.length,
    duplicates: deduplicated.duplicateCount,
    expired: expiredExisting.count,
    sources: sourceResults,
    searchPlanId: storedPlan.id,
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

export async function processApplication(
  userId: string,
  applicationId: string,
  options?: { force?: boolean }
) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      tailoredResume: true,
      coverLetter: true,
    },
  });
  if (!application) throw new Error("Application not found");

  const masterResume = await prisma.masterResume.findUnique({
    where: { userId },
  });
  if (!masterResume) throw new Error("Master resume required");

  if (
    !options?.force &&
    application.tailoredResume &&
    application.coverLetter &&
    ["PENDING_REVIEW", "RESUME_GENERATED", "COVER_LETTER_GENERATED", "SUBMITTING", "SUBMITTED"].includes(
      application.status
    )
  ) {
    return {
      tailoredResume: application.tailoredResume,
      coverLetter: application.coverLetter,
      status: application.status,
      reused: true,
    };
  }

  await assertCanUseFeature(userId, "resume_tailor");

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

  const tailoredResume = await prisma.tailoredResume.upsert({
    where: { applicationId: application.id },
    create: {
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
    update: {
      title: tailored.title,
      content: tailored as Prisma.InputJsonValue,
      rawText: tailored.rawText,
      matchScore: application.matchScore,
      highlights: tailored.highlights,
      fileUrl: null,
    },
  });

  const savedCoverLetter = await prisma.coverLetter.upsert({
    where: { applicationId: application.id },
    create: {
      userId,
      jobId: job.id,
      applicationId: application.id,
      title: coverLetter.title,
      content: coverLetter.content,
      tone: coverLetter.tone,
      version: 1,
    },
    update: {
      title: coverLetter.title,
      content: coverLetter.content,
      tone: coverLetter.tone,
      version: { increment: 1 },
    },
  });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const newStatus =
    settings?.requireReview !== false ? "PENDING_REVIEW" : "RESUME_GENERATED";

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: newStatus,
      failureReason: null,
    },
  });

  await createAuditLog({
    userId,
    action: "APPLICATION_PROCESSED",
    resource: "application",
    resourceId: applicationId,
    message: `Generated resume and cover letter for ${job.title} at ${job.company}`,
    level: "AUDIT",
  });

  await recordUsage(userId, "resume_tailor", 1, {
    idempotencyKey: options?.force
      ? `resume_tailor:${applicationId}:v${savedCoverLetter.version}`
      : `resume_tailor:${applicationId}`,
  });

  return {
    tailoredResume,
    coverLetter: savedCoverLetter,
    status: newStatus,
    reused: false,
  };
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
