import prisma from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { createBrowserClient } from "@/lib/browser/client";
import {
  enqueueBrowserTask,
  shouldUseBrowserQueue,
  isBrowserBridgeAvailable,
} from "@/lib/browser/queue";
import { getAutomatorForUrl } from "@/lib/automation/registry";
import { prepareApplicationForm } from "@/lib/automation/prepare-flow";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";
import { uploadToDrive, ensureDriveFolder } from "@/lib/google/drive";
import { syncApplicationsToSheet } from "@/lib/google/sheets";
import { syncGmail } from "@/lib/google/gmail";
import { syncInterviewsToCalendar } from "@/lib/google/calendar";
import { isGoogleConnected } from "@/lib/google/oauth";
import {
  searchJobs,
  analyzeJob,
  matchJob,
  processApplication,
} from "@/lib/jobs/pipeline";
import type { Prisma } from "@prisma/client";
import { mapSubmissionToApplicationStatus } from "@/lib/applications/automation-policy";
import { preparationReuseDecision } from "@/lib/applications/preparation-state";
import {
  answerToText,
  creditProvisionedAnswerUsage,
  type AnswerUsageCreditSummary,
} from "@/lib/applications/answer-bank-service";
import {
  assertApplicationReadyForDocuments,
  assertApplicationReadyForPreparation,
} from "@/lib/applications/eligibility-gate";
import { assertCanUseFeature, recordUsage } from "@/lib/entitlements";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const SUCCESSFUL_PREP_STATUSES = new Set([
  "PENDING_REVIEW",
  "AWAITING_APPROVAL",
  "SUBMITTING",
  "SUBMITTED",
]);

async function loadConfirmedAnswerKeys(userId: string): Promise<string[]> {
  const rows = await prisma.applicationAnswerBank.findMany({
    where: { userId, confirmationState: "confirmed" },
    select: { questionKey: true },
  });
  return rows.map((row) => row.questionKey);
}

async function loadAnswerUsageSummary(
  userId: string,
  applicationId: string,
  provisioned: string[]
): Promise<AnswerUsageCreditSummary> {
  const answers = await prisma.applicationAnswerBank.findMany({
    where: {
      userId,
      questionKey: { in: provisioned },
      confirmationState: "confirmed",
    },
    select: { id: true, questionKey: true, usageCount: true },
  });
  const usages = answers.length
    ? await prisma.applicationAnswerUsage.findMany({
        where: {
          userId,
          applicationId,
          answerBankId: { in: answers.map((answer) => answer.id) },
        },
        select: { id: true, answerBankId: true },
      })
    : [];
  const usageByAnswer = new Map(
    usages.map((usage) => [usage.answerBankId, usage.id])
  );
  const alreadyPresent = answers
    .filter((answer) => usageByAnswer.has(answer.id))
    .map((answer) => ({
      answerBankId: answer.id,
      fieldKey: answer.questionKey,
      inserted: false,
      alreadyRecorded: true,
      currentUsageCount: answer.usageCount,
      usageRecordId: usageByAnswer.get(answer.id) ?? null,
    }));
  return {
    provisioned,
    inserted: [],
    alreadyPresent,
    currentUsageCounts: Object.fromEntries(
      answers.map((answer) => [answer.questionKey, answer.usageCount])
    ),
  };
}

export interface AgentRunResult {
  searched: { total: number; new: number };
  analyzed: number;
  matched: number;
  processed: number;
  prepared: number;
  submitted: number;
  googleSync?: Record<string, unknown>;
  errors: string[];
}

export async function runAutonomousAgent(userId: string): Promise<AgentRunResult> {
  const result: AgentRunResult = {
    searched: { total: 0, new: 0 },
    analyzed: 0,
    matched: 0,
    processed: 0,
    prepared: 0,
    submitted: 0,
    errors: [],
  };

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  if (!user || !settings) {
    throw new Error("User or settings not found");
  }

  const masterResume = await prisma.masterResume.findUnique({ where: { userId } });
  if (!masterResume) {
    throw new Error("Upload a master resume before running the agent");
  }

  try {
    result.searched = await searchJobs(userId);
  } catch (error) {
    result.errors.push(`Search failed: ${error}`);
  }

  const jobs = await prisma.job.findMany({
    where: {
      userId,
      status: "ACTIVE",
      OR: [
        { analyzedAt: null },
        { matchScore: null },
      ],
    },
    take: 25,
  });

  for (const job of jobs) {
    try {
      if (!job.analyzedAt) {
        await analyzeJob(userId, job.id);
        result.analyzed++;
      }
      const { status } = await matchJob(userId, job.id);
      if (status === "MATCHED") result.matched++;
    } catch (error) {
      result.errors.push(`Job ${job.id}: ${error}`);
    }
  }

  const matchedApps = await prisma.application.findMany({
    where: {
      userId,
      status: { in: ["MATCHED", "DISCOVERED", "ANALYZED"] },
      job: { matchScore: { gte: settings.matchThreshold } },
    },
    include: { job: true },
    take: 10,
  });

  for (const app of matchedApps) {
    try {
      await processApplication(userId, app.id);
      result.processed++;
    } catch (error) {
      result.errors.push(`Process ${app.id}: ${error}`);
    }
  }

  const reviewApps = await prisma.application.findMany({
    where: {
      userId,
      status: { in: ["PENDING_REVIEW", "RESUME_GENERATED", "COVER_LETTER_GENERATED"] },
    },
    include: {
      job: true,
      tailoredResume: true,
      coverLetter: true,
    },
    take: 5,
  });

  // Agent runs may prepare applications, but never submit.
  // Final submission requires explicit per-attempt confirmation on the application API.
  for (const app of reviewApps) {
    try {
      const prep = await prepareApplicationSubmission(userId, app.id, {
        autoSubmit: false,
      });
      if (prep.status === "submitted") result.submitted++;
      else result.prepared++;
    } catch (error) {
      result.errors.push(`Prepare ${app.id}: ${error}`);
    }
  }

  if (await isGoogleConnected(userId)) {
    const googleSync: Record<string, unknown> = {};
    try {
      if (settings.gmailSyncEnabled) googleSync.gmail = await syncGmail(userId);
      if (settings.sheetsSyncEnabled) googleSync.sheets = await syncApplicationsToSheet(userId);
      if (settings.calendarSyncEnabled) googleSync.calendar = await syncInterviewsToCalendar(userId);
      result.googleSync = googleSync;
    } catch (error) {
      result.errors.push(`Google sync: ${error}`);
    }
  }

  await createAuditLog({
    userId,
    action: "AGENT_RUN_COMPLETE",
    message: `Agent run: ${result.processed} processed, ${result.prepared} prepared, ${result.submitted} submitted`,
    level: "AUDIT",
    metadata: JSON.parse(JSON.stringify(result)),
  });

  return result;
}

export async function prepareApplicationSubmission(
  userId: string,
  applicationId: string,
  options?: { autoSubmit?: boolean }
) {
  if (options?.autoSubmit) {
    await assertCanUseFeature(userId, "application");
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      tailoredResume: true,
      coverLetter: true,
    },
  });

  if (!application) throw new Error("Application not found");
  assertApplicationReadyForPreparation(application.job.matchAnalysis);
  if (!application.tailoredResume || !application.coverLetter) {
    throw new Error(
      "Generate tailored resume and cover letter before preparing this application"
    );
  }
  const persistedDocuments = application.documents as {
    browserTaskId?: string;
  } | null;
  const activeTask = persistedDocuments?.browserTaskId
    ? await prisma.browserTask.findFirst({
        where: {
          id: persistedDocuments.browserTaskId,
          userId,
          applicationId,
          status: { in: ["pending", "running"] },
        },
      })
    : null;
  const reuseDecision = preparationReuseDecision({
    applicationStatus: application.status,
    autoSubmit: Boolean(options?.autoSubmit),
    hasPersistedFormData: Boolean(application.formData),
    activeTaskId: activeTask?.id,
  });
  const provisionedKeys = await loadConfirmedAnswerKeys(userId);
  if (reuseDecision === "already_submitted") {
    const answerUsage = await loadAnswerUsageSummary(
      userId,
      applicationId,
      provisionedKeys
    );
    return {
      success: true,
      status: "submitted" as const,
      message: "Application was already submitted. Duplicate delivery was ignored.",
      reused: true,
      applicationId,
      preparationStatus: "submitted" as const,
      answerUsage,
      noRealSubmissionPerformed: true,
    };
  }
  if (reuseDecision === "active_delivery") {
    const answerUsage = await loadAnswerUsageSummary(
      userId,
      applicationId,
      provisionedKeys
    );
    return {
      success: true,
      status:
        application.status === "SUBMITTING"
          ? ("submitting" as const)
          : ("pending_review" as const),
      message: "Application preparation is already active.",
      formData: activeTask ? { browserTaskId: activeTask.id } : undefined,
      reused: true,
      applicationId,
      preparationStatus:
        application.status === "SUBMITTING"
          ? ("submitting" as const)
          : ("pending_review" as const),
      answerUsage,
      noRealSubmissionPerformed: !options?.autoSubmit,
    };
  }
  if (reuseDecision === "already_prepared") {
    const answerUsage = await loadAnswerUsageSummary(
      userId,
      applicationId,
      provisionedKeys
    );
    return {
      success: true,
      status: "pending_review" as const,
      message: "Prepared application is already waiting for your review.",
      formData: application.formData as Record<string, unknown>,
      reused: true,
      applicationId,
      preparationStatus: "pending_review" as const,
      answerUsage,
      noRealSubmissionPerformed: true,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const resumeText = application.tailoredResume.rawText;

  const pdf = await generateResumePdf({
    title: application.tailoredResume.title || "Resume",
    rawText: resumeText,
    highlights: application.tailoredResume.highlights,
  });

  // Prefer Drive URL if available; never treat OS temp paths as durable artifacts.
  let fileUrl = application.tailoredResume?.fileUrl;
  if (fileUrl && (fileUrl.includes(tmpdir()) || fileUrl.startsWith("/tmp"))) {
    fileUrl = null;
  }
  const tmpDir = join(tmpdir(), "job-agent");
  await mkdir(tmpDir, { recursive: true });
  const pdfPath = join(
    tmpDir,
    `resume-${applicationId}.pdf`
  );
  await writeFile(pdfPath, pdf);

  if (application.tailoredResume) {
    await prisma.tailoredResume.update({
      where: { id: application.tailoredResume.id },
      data: { fileUrl: fileUrl ?? null },
    });
  }

  if (await isGoogleConnected(userId)) {
    try {
      await ensureDriveFolder(userId);
      const uploaded = await uploadToDrive(
        userId,
        `${application.job.company}-${application.job.title}-resume.pdf`,
        pdf
      );
      fileUrl = uploaded.webViewLink || fileUrl;
      if (application.tailoredResume) {
        await prisma.tailoredResume.update({
          where: { id: application.tailoredResume.id },
          data: { fileUrl },
        });
      }
    } catch {
      // Drive upload optional
    }
  }

  const automator = getAutomatorForUrl(application.job.sourceUrl);
  if (!automator) {
    const answerUsage =
      options?.autoSubmit
        ? {
            provisioned: provisionedKeys,
            inserted: [],
            alreadyPresent: [],
            currentUsageCounts: {},
          }
        : await creditProvisionedAnswerUsage(
            userId,
            applicationId,
            provisionedKeys,
            "unsupported_platform_dry_run"
          );
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "UNSUPPORTED",
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
          answerUsage,
          noRealSubmissionPerformed: !options?.autoSubmit,
        } as Prisma.InputJsonValue,
        failureReason: "UNSUPPORTED_PLATFORM",
      },
    });
    return {
      success: false,
      status: "requires_manual" as const,
      message: "Documents generated — manual submission required for this platform",
      applicationId,
      preparationStatus: "unsupported",
      answerUsage,
      noRealSubmissionPerformed: !options?.autoSubmit,
    };
  }

  if (options?.autoSubmit) {
    const acquired = await prisma.application.updateMany({
      where: {
        id: applicationId,
        userId,
        status: { notIn: ["SUBMITTING", "SUBMITTED"] },
      },
      data: { status: "SUBMITTING", lastAttemptAt: new Date() },
    });
    if (acquired.count === 0) {
      return {
        success: true,
        status: "submitting" as const,
        message: "Submission authorization is already being processed.",
        reused: true,
      };
    }
  }

  if (shouldUseBrowserQueue() && !isBrowserBridgeAvailable()) {
    const task = await enqueueBrowserTask({
      userId,
      applicationId,
      type: "PREPARE_APPLICATION",
      platform: automator.platform,
      payload: {
        autoSubmit: options?.autoSubmit ?? false,
        applicationId,
        provisionedAnswerKeys: provisionedKeys,
      },
    });
    // Dry-run queue path sets PENDING_REVIEW immediately; credit provisioned
    // confirmed answers here so the prepare response is authoritative without
    // waiting on the browser worker. Worker callbacks remain idempotent; cancel
    // and hard failure revoke usage.
    const answerUsage = await creditProvisionedAnswerUsage(
      userId,
      applicationId,
      provisionedKeys,
      "queued_preparation"
    );
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: options?.autoSubmit ? "SUBMITTING" : "PENDING_REVIEW",
        lastAttemptAt: new Date(),
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
          browserTaskId: task.id,
          answerUsage,
          noRealSubmissionPerformed: !options?.autoSubmit,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      success: true,
      status: options?.autoSubmit
        ? ("submitting" as const)
        : ("pending_review" as const),
      message: options?.autoSubmit
        ? "Authorized submission queued. You can leave this page and track progress here."
        : "Application preparation queued. Kairela will stop for your review.",
      formData: { browserTaskId: task.id },
      applicationId,
      preparationStatus: options?.autoSubmit
        ? ("submitting" as const)
        : ("pending_review" as const),
      answerUsage,
      noRealSubmissionPerformed: !options?.autoSubmit,
    };
  }

  const [profileSettings, confirmedAnswerRows] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.applicationAnswerBank.findMany({
      where: { userId, confirmationState: "confirmed" },
      select: { questionKey: true, answer: true },
    }),
  ]);
  const confirmedAnswers = Object.fromEntries(
    confirmedAnswerRows.flatMap((answer) => {
      const value = answerToText(answer.answer);
      return value == null ? [] : [[answer.questionKey, value]];
    })
  );

  const profile = {
    fullName: user?.fullName || user?.email || "Applicant",
    email: user?.email || "",
    linkedinUrl: user?.linkedinUrl || undefined,
    location: user?.currentLocation || profileSettings?.locations?.[0],
    experienceYears: profileSettings?.experienceYears,
    salaryMin: profileSettings?.salaryMin,
    salaryMax: profileSettings?.salaryMax,
    salaryCurrency: profileSettings?.salaryCurrency,
    visaSponsorshipRequired: profileSettings?.visaSponsorshipRequired,
    willingToRelocate: profileSettings?.willingToRelocate,
    noticePeriodDays: profileSettings?.noticePeriodDays,
    workModes: profileSettings?.workModes as
      | Array<"REMOTE" | "HYBRID" | "ONSITE">
      | undefined,
    confirmedAnswers,
  };

  const browser = await createBrowserClient();
  try {
    const submission = await prepareApplicationForm({
      browser,
      jobUrl: application.job.sourceUrl,
      platform: automator.platform,
      profile,
      documents: {
        resumeText,
        resumePdf: pdf,
        coverLetterText: application.coverLetter?.content,
      },
      autoSubmit: options?.autoSubmit,
    });

    const mapped = mapSubmissionToApplicationStatus(
      submission,
      Boolean(options?.autoSubmit)
    );
    const answeredFields = Array.isArray(submission.formData?.answeredFields)
      ? submission.formData.answeredFields.filter(
          (field): field is string => typeof field === "string"
        )
      : [];
    const cancelled = Boolean(
      submission.formData &&
        typeof submission.formData === "object" &&
        "cancelled" in submission.formData &&
        (submission.formData as { cancelled?: boolean }).cancelled
    );
    // Dry-run credits provisioned confirmed answers whenever preparation ran
    // without cancel/hard-failure (including NEEDS_INFORMATION / blocked states),
    // matching the queued path that credits at enqueue time. Authorized submit
    // still credits only on successful terminal statuses.
    const shouldCreditUsage = options?.autoSubmit
      ? SUCCESSFUL_PREP_STATUSES.has(mapped.status)
      : !cancelled && mapped.status !== "FAILED";
    const answerUsage = shouldCreditUsage
      ? await creditProvisionedAnswerUsage(
          userId,
          applicationId,
          [...new Set([...provisionedKeys, ...answeredFields])],
          "direct_preparation"
        )
      : {
          provisioned: provisionedKeys,
          inserted: [],
          alreadyPresent: [],
          currentUsageCounts: {},
        };

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: mapped.status,
        submittedAt: mapped.status === "SUBMITTED" ? new Date() : undefined,
        formData: submission.formData as Prisma.InputJsonValue,
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
          answerUsage,
          noRealSubmissionPerformed: !options?.autoSubmit,
        } as Prisma.InputJsonValue,
        failureReason: mapped.failureReason,
        lastAttemptAt: new Date(),
        requiresReview:
          !options?.autoSubmit ||
          ["PENDING_REVIEW", "AWAITING_APPROVAL", "NEEDS_INFORMATION"].includes(
            mapped.status
          ),
      },
    });

    if (mapped.status === "SUBMITTED") {
      await recordUsage(userId, "application", 1, {
        idempotencyKey: `application_submitted:${applicationId}`,
      });
      // Phase D: retain the exact document that was actually submitted,
      // alongside the score history already recorded when it was tailored.
      await prisma.applicationScoreRecord.updateMany({
        where: { applicationId, userId },
        data: { submittedDocument: resumeText, submittedAt: new Date() },
      });
    }

    return {
      ...submission,
      message: mapped.message,
      success:
        mapped.status === "SUBMITTED" ||
        mapped.status === "PENDING_REVIEW" ||
        mapped.status === "AWAITING_APPROVAL",
      applicationId,
      preparationStatus: mapped.status.toLowerCase(),
      answerUsage,
      noRealSubmissionPerformed: !options?.autoSubmit,
    };
  } finally {
    await browser.close();
  }
}
