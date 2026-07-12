import prisma from "@/lib/db";
import { extractJobSkills } from "@/lib/ai/job-analyzer";
import { calculateMatchScore } from "@/lib/ai/match-scorer";
import { tailorResume } from "@/lib/ai/resume-tailor";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { createAuditLog } from "@/lib/audit";
import type { JobSource, Prisma } from "@prisma/client";
import { GreenhouseAdapter, LeverAdapter, BrowserJobAdapter } from "./adapters";
import type { DiscoveredJob } from "./types";

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

export async function searchJobs(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) throw new Error("User settings not found");

  const filters = {
    titles: settings.jobTitles.length > 0 ? settings.jobTitles : ["Software Engineer"],
    locations: settings.locations,
    experienceYears: settings.experienceYears ?? undefined,
    skills: settings.requiredSkills,
  };

  const adapters = [
    new GreenhouseAdapter(),
    new LeverAdapter(),
    new BrowserJobAdapter(),
  ];

  const discovered: DiscoveredJob[] = [];
  for (const adapter of adapters) {
    if (!settings.enabledSources.includes(adapter.source as JobSource)) continue;
    try {
      const jobs = await adapter.search(filters);
      discovered.push(...jobs);
    } catch (error) {
      await createAuditLog({
        userId,
        action: "JOB_SEARCH_ERROR",
        message: `Failed to search ${adapter.name}: ${error}`,
        level: "ERROR",
      });
    }
  }

  let newCount = 0;
  for (const job of discovered) {
    const existing = await prisma.job.findFirst({
      where: {
        userId,
        source: job.source,
        externalId: job.externalId,
      },
    });
    if (existing) continue;

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
        metadata: (job.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        applications: {
          create: {
            userId,
            status: "DISCOVERED",
          },
        },
      },
    });
    newCount++;
  }

  await createAuditLog({
    userId,
    action: "JOB_SEARCH_COMPLETE",
    message: `Discovered ${discovered.length} jobs, ${newCount} new`,
    level: "INFO",
  });

  return { total: discovered.length, new: newCount };
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

  const tailoredResume = await prisma.tailoredResume.create({
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
    },
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
