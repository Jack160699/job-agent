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
import { partitionByExistence } from "./job-matching";
import {
  assertCanUseFeature,
  consumeFeature,
  recordUsage,
} from "@/lib/entitlements";

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
  const searchStart = Date.now();
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
  const sourceFetchMs: Record<string, number> = {};

  const SOURCE_TIMEOUT_MS = Number(process.env.JOB_SOURCE_TIMEOUT_MS) || 10_000;
  const SOURCE_CONCURRENCY = 4; // Greenhouse, Lever, Ashby, Workday — one slot each today.

  async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Source timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /** One source's full fetch + health-bookkeeping — runs independently so one slow/failed source cannot block the others. */
  async function fetchSource(adapter: (typeof adapters)[number]): Promise<void> {
    const currentHealth = await prisma.jobSourceHealth.findUnique({
      where: { userId_source: { userId, source: adapter.source as JobSource } },
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
      if (
        healthDecision.until &&
        (!currentHealth?.disabledUntil ||
          currentHealth.disabledUntil.getTime() !== healthDecision.until.getTime())
      ) {
        await prisma.jobSourceHealth.upsert({
          where: { userId_source: { userId, source: adapter.source as JobSource } },
          create: {
            userId,
            source: adapter.source as JobSource,
            disabledUntil: healthDecision.until,
            lastError: healthDecision.reason,
          },
          update: {
            disabledUntil: healthDecision.until,
            lastError: healthDecision.reason,
          },
        });
      }
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
      return;
    }

    const fetchStart = Date.now();
    try {
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_PROGRESS",
        message: `Fetching from ${adapter.name} (${adapter.source})…`,
        level: "INFO",
        metadata: { ats: adapter.source },
      });
      const jobs = await withTimeout(adapter.search(filters), SOURCE_TIMEOUT_MS);
      sourceFetchMs[adapter.source] = Date.now() - fetchStart;
      discovered.push(...jobs);
      const invalidCount = jobs.filter(
        (job) => !job.title || !job.company || !job.sourceUrl
      ).length;
      sourceResults.push({
        source: adapter.source,
        requested: true,
        success: true,
        fetched: jobs.length,
        invalid: invalidCount,
        duplicates: 0,
        expired: 0,
        relevant: 0,
      });
      await prisma.jobSourceHealth.upsert({
        where: { userId_source: { userId, source: adapter.source as JobSource } },
        create: {
          userId,
          source: adapter.source as JobSource,
          requests: 1,
          successfulResponses: 1,
          emptyResponses: jobs.length === 0 ? 1 : 0,
          invalidJobs: invalidCount,
          lastSuccessfulFetch: new Date(),
        },
        update: {
          requests: { increment: 1 },
          successfulResponses: { increment: 1 },
          emptyResponses: jobs.length === 0 ? { increment: 1 } : undefined,
          invalidJobs: { increment: invalidCount },
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
        metadata: { ats: adapter.source, count: jobs.length, durationMs: sourceFetchMs[adapter.source] },
      });
    } catch (error) {
      sourceFetchMs[adapter.source] = Date.now() - fetchStart;
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
        where: { userId_source: { userId, source: adapter.source as JobSource } },
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

  await progress("fetching_jobs", {
    label: "Searching relevant sources",
    sources: adapters
      .filter((a) => enabled.includes(a.source as JobSource))
      .map((a) => a.source),
  });

  // Bounded concurrency: every enabled source fetches independently
  // (Promise.allSettled), each with its own timeout, so one slow or failing
  // source (e.g. Workday) can never block the others. Current source count
  // (4) is within SOURCE_CONCURRENCY, so this already runs fully in
  // parallel; the cap exists so adding future sources stays bounded.
  const toFetch = adapters.filter((a) => enabled.includes(a.source as JobSource));
  for (let i = 0; i < toFetch.length; i += SOURCE_CONCURRENCY) {
    const batch = toFetch.slice(i, i + SOURCE_CONCURRENCY);
    await Promise.allSettled(batch.map((adapter) => fetchSource(adapter)));
  }

  await createAuditLog({
    userId,
    action: "JOB_SEARCH_SOURCES_COMPLETE",
    message: `Fetched from ${sourceResults.filter((r) => r.requested).length} sources in parallel`,
    level: "INFO",
    metadata: { sourceFetchMs, sourceResults: sourceResults.map((r) => ({ source: r.source, success: r.success, fetched: r.fetched })) },
  });

  const dedupeStart = Date.now();
  await progress("deduplicating", {
    label: "Removing duplicates",
    rawCount: discovered.length,
  });
  const deduplicated = deduplicateJobs(
    discovered.filter(
      (job) => Boolean(job.title && job.company && job.sourceUrl)
    )
  );
  const deduplicationMs = Date.now() - dedupeStart;

  const filterStart = Date.now();
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

  const filteringMs = Date.now() - filterStart;
  const persistStart = Date.now();
  await progress("scoring", {
    label: "Ranking opportunities",
    unique: filtered.length,
  });

  interface PersistCandidate {
    origin: "filtered" | "excluded";
    job: DeduplicatedJob;
    provenance: ScoredJob["provenance"];
    matchScore: number;
    matchAnalysis: Prisma.InputJsonValue;
    status: "ACTIVE" | "ARCHIVED";
    extraMetadata?: Record<string, unknown>;
  }

  const candidates: PersistCandidate[] = [
    ...filtered.map(
      (job): PersistCandidate => ({
        origin: "filtered",
        job,
        provenance: job.provenance,
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
        status: "ACTIVE",
        extraMetadata: { preferenceFiltered: true },
      })
    ),
    ...excluded.slice(0, 50).map(
      (ex): PersistCandidate => ({
        origin: "excluded",
        job: ex.job,
        provenance: ex.job.provenance,
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
        status: "ARCHIVED",
        extraMetadata: { excludedView: true, exclusionReason: ex.reason },
      })
    ),
  ];

  // Bulk existence lookup: one query for every candidate instead of one
  // findFirst per job. Builds in-memory maps so each candidate is matched
  // against the same three identity keys the original per-job OR used.
  const orConditions: Prisma.JobWhereInput[] = [];
  const canonicalUrls = new Set<string>();
  const fingerprints = new Set<string>();
  for (const c of candidates) {
    if (c.job.externalId) {
      orConditions.push({ source: c.job.source, externalId: c.job.externalId });
    }
    canonicalUrls.add(c.job.canonicalUrl);
    fingerprints.add(c.job.fingerprint);
  }
  if (canonicalUrls.size > 0) {
    orConditions.push({ canonicalUrl: { in: Array.from(canonicalUrls) } });
  }
  if (fingerprints.size > 0) {
    orConditions.push({ descriptionFingerprint: { in: Array.from(fingerprints) } });
  }

  const existingJobs =
    orConditions.length > 0
      ? await prisma.job.findMany({ where: { userId, OR: orConditions } })
      : [];

  const { toUpdate, toCreate } = partitionByExistence(
    candidates.map((c) => ({
      ...c,
      source: c.job.source,
      externalId: c.job.externalId,
      canonicalUrl: c.job.canonicalUrl,
      fingerprint: c.job.fingerprint,
    })),
    existingJobs
  );

  let newCount = 0;
  let relevantCount = 0;

  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map(({ id, candidate: c }) =>
        prisma.job.update({
          where: { id },
          data: {
            status: c.status,
            matchScore: c.matchScore,
            matchAnalysis: c.matchAnalysis,
            ...(c.status === "ACTIVE" ? { removedAt: null } : {}),
          },
        })
      )
    );

    const provenanceOps = toUpdate.flatMap(({ id, candidate: c }) =>
      c.provenance.map((p) =>
        prisma.jobProvenance.upsert({
          where: {
            userId_source_sourceUrl: { userId, source: p.source, sourceUrl: p.sourceUrl },
          },
          create: { userId, jobId: id, ...p },
          update: { jobId: id, externalId: p.externalId, lastSeenAt: new Date() },
        })
      )
    );
    if (provenanceOps.length > 0) await prisma.$transaction(provenanceOps);

    relevantCount += toUpdate.filter(({ candidate }) => candidate.origin === "filtered").length;
  }

  if (toCreate.length > 0) {
    await progress("saving", {
      label: "Preparing results",
      count: toCreate.length,
    });

    const jobIds = toCreate.map(() => crypto.randomUUID());
    const jobRows: Prisma.JobCreateManyInput[] = toCreate.map((c, i) => ({
      id: jobIds[i],
      userId,
      externalId: c.job.externalId,
      source: c.job.source,
      sourceUrl: c.job.sourceUrl,
      canonicalUrl: c.job.canonicalUrl,
      descriptionFingerprint: c.job.fingerprint,
      title: c.job.title,
      company: c.job.company,
      location: c.job.location,
      description: c.job.description,
      postedAt: c.job.postedAt,
      closesAt: c.job.closesAt,
      removedAt: c.job.removedAt,
      workMode: c.job.workMode,
      employmentType: c.job.employmentType,
      salaryMin: c.job.salaryMin,
      salaryMax: c.job.salaryMax,
      salaryCurrency: c.job.salaryCurrency,
      visaSponsorship: c.job.visaSponsorship,
      status: c.status,
      matchScore: c.matchScore,
      matchAnalysis: c.matchAnalysis,
      metadata: {
        ...(c.job.metadata ?? {}),
        ...(c.extraMetadata ?? {}),
      } as unknown as Prisma.InputJsonValue,
    }));

    const appRows: Prisma.ApplicationCreateManyInput[] = [];
    const provRows: Prisma.JobProvenanceCreateManyInput[] = [];
    toCreate.forEach((c, i) => {
      if (c.origin === "filtered") {
        appRows.push({ userId, jobId: jobIds[i], status: "DISCOVERED", matchScore: c.matchScore });
      }
      for (const p of c.provenance) {
        provRows.push({ userId, jobId: jobIds[i], ...p });
      }
    });

    await prisma.$transaction([
      prisma.job.createMany({ data: jobRows }),
      ...(appRows.length ? [prisma.application.createMany({ data: appRows })] : []),
      ...(provRows.length ? [prisma.jobProvenance.createMany({ data: provRows })] : []),
    ]);

    newCount = toCreate.filter((c) => c.origin === "filtered").length;
    relevantCount += newCount;
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
  await prisma.application.updateMany({
    where: {
      userId,
      job: { status: "EXPIRED" },
      status: {
        in: [
          "DISCOVERED",
          "ANALYZED",
          "MATCHED",
          "SKIPPED",
          "RESUME_GENERATED",
          "COVER_LETTER_GENERATED",
          "PENDING_REVIEW",
          "NEEDS_INFORMATION",
          "AWAITING_APPROVAL",
          "BLOCKED_CAPTCHA",
          "BLOCKED_LOGIN",
          "UNSUPPORTED",
          "FAILED",
        ],
      },
    },
    data: { status: "EXPIRED", failureReason: "JOB_EXPIRED" },
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

  const persistenceMs = Date.now() - persistStart;
  const totalSearchMs = Date.now() - searchStart;
  const timings = {
    sourceFetchMs,
    deduplicationMs,
    filteringMs,
    persistenceMs,
    totalSearchMs,
  };

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
    timings,
  });

  await createAuditLog({
    userId,
    action: "JOB_SEARCH_COMPLETE",
    message: `Found ${discovered.length} raw, ${relevantCount} relevant, ${newCount} new (${excluded.length} excluded) in ${totalSearchMs}ms`,
    level: "INFO",
    metadata: {
      searchPlanId: storedPlan.id,
      duplicates: deduplicated.duplicateCount,
      expired: expiredExisting.count,
      sources: sourceResults,
      excluded: excluded.slice(0, 10),
      timings,
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
    timings,
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
  if (["EXPIRED", "CLOSED"].includes(application.job.status)) {
    throw new Error("JOB_NOT_ACTIVE");
  }

  if (
    !options?.force &&
    application.tailoredResume &&
    application.coverLetter &&
    ["PENDING_REVIEW", "AWAITING_APPROVAL", "RESUME_GENERATED", "COVER_LETTER_GENERATED", "SUBMITTING", "SUBMITTED"].includes(
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

  const masterResume = await prisma.masterResume.findUnique({
    where: { userId },
  });
  if (!masterResume) throw new Error("Master resume required");

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

  const sourceMasterSnapshot = {
    title: masterResume.title,
    version: masterResume.version,
    rawText: masterResume.rawText,
    skills: masterResume.skills,
  } as Prisma.InputJsonValue;
  const groundingReport =
    tailored.groundingReport as unknown as Prisma.InputJsonValue;

  const tailoredResume = await prisma.$transaction(async (tx) => {
    const existing = application.tailoredResume;
    if (!existing) {
      return tx.tailoredResume.create({
        data: {
          userId,
          masterResumeId: masterResume.id,
          jobId: job.id,
          applicationId: application.id,
          title: tailored.title,
          content: tailored as unknown as Prisma.InputJsonValue,
          rawText: tailored.rawText,
          matchScore: application.matchScore,
          highlights: tailored.highlights,
          fileUrl: null,
          sourceMasterVersion: masterResume.version,
          sourceMasterTitle: masterResume.title,
          sourceMasterSnapshot,
          groundingReport,
        },
      });
    }

    await tx.tailoredResumeVersion.upsert({
      where: {
        tailoredResumeId_version: {
          tailoredResumeId: existing.id,
          version: existing.version,
        },
      },
      create: {
        tailoredResumeId: existing.id,
        userId,
        version: existing.version,
        title: existing.title,
        content: existing.content as Prisma.InputJsonValue,
        rawText: existing.rawText,
        highlights: existing.highlights,
        sourceMasterVersion: existing.sourceMasterVersion,
        sourceMasterTitle: existing.sourceMasterTitle,
        sourceMasterSnapshot:
          existing.sourceMasterSnapshot as Prisma.InputJsonValue,
        groundingReport: existing.groundingReport as Prisma.InputJsonValue,
      },
      update: {},
    });
    return tx.tailoredResume.update({
      where: { id: existing.id },
      data: {
        masterResumeId: masterResume.id,
        title: tailored.title,
        content: tailored as unknown as Prisma.InputJsonValue,
        rawText: tailored.rawText,
        matchScore: application.matchScore,
        highlights: tailored.highlights,
        fileUrl: null,
        version: { increment: 1 },
        sourceMasterVersion: masterResume.version,
        sourceMasterTitle: masterResume.title,
        sourceMasterSnapshot,
        groundingReport,
        archivedAt: null,
      },
    });
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
    metadata: {
      groundingVersion: tailored.groundingReport.version,
      excludedReasonCodes: [
        ...new Set(
          tailored.groundingReport.excluded.map((item) => item.reasonCode)
        ),
      ],
      excludedCount: tailored.groundingReport.excluded.length,
      gapCount: tailored.groundingReport.gaps.length,
    },
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
