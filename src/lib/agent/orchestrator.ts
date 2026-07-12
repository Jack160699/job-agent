import prisma from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { createBrowserClient } from "@/lib/browser/client";
import {
  enqueueBrowserTask,
  shouldUseBrowserQueue,
  isBrowserBridgeAvailable,
} from "@/lib/browser/queue";
import { getAutomatorForUrl } from "@/lib/automation/registry";
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
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

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

  for (const app of reviewApps) {
    try {
      const prep = await prepareApplicationSubmission(userId, app.id, {
        autoSubmit: settings.autoSubmitEnabled && !settings.requireReview,
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
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      tailoredResume: true,
      coverLetter: true,
    },
  });

  if (!application) throw new Error("Application not found");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const resumeText =
    application.tailoredResume?.rawText ||
    (await prisma.masterResume.findUnique({ where: { userId } }))?.rawText ||
    "";

  const pdf = await generateResumePdf({
    title: application.tailoredResume?.title || "Resume",
    rawText: resumeText,
    skills: application.tailoredResume
      ? undefined
      : (await prisma.masterResume.findUnique({ where: { userId } }))?.skills,
    highlights: application.tailoredResume?.highlights,
  });

  let fileUrl = application.tailoredResume?.fileUrl;
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
      data: { fileUrl: pdfPath },
    });
    fileUrl = pdfPath;
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
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "PENDING_REVIEW",
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      success: true,
      status: "pending_review" as const,
      message: "Documents generated — manual submission required for this platform",
    };
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
      },
    });
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "PENDING_REVIEW",
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
          browserTaskId: task.id,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      success: true,
      status: "pending_review" as const,
      message: `Browser automation queued (task ${task.id})`,
      formData: { browserTaskId: task.id },
    };
  }

  const browser = await createBrowserClient();
  try {
    const submission = await automator.prepareApplication(
      browser,
      application.job.sourceUrl,
      {
        fullName: user?.fullName || user?.email || "Applicant",
        email: user?.email || "",
      },
      {
        resumeText,
        resumePdf: pdf,
        coverLetterText: application.coverLetter?.content,
      },
      { autoSubmit: options?.autoSubmit }
    );

    const newStatus: ApplicationStatus =
      submission.status === "submitted"
        ? "SUBMITTED"
        : submission.status === "pending_review"
          ? "PENDING_REVIEW"
          : submission.status === "failed"
            ? "FAILED"
            : "PENDING_REVIEW";

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        submittedAt: newStatus === "SUBMITTED" ? new Date() : undefined,
        formData: submission.formData as Prisma.InputJsonValue,
        documents: {
          resumePdfPath: pdfPath,
          coverLetter: application.coverLetter?.content,
        } as Prisma.InputJsonValue,
        failureReason: submission.success ? null : submission.message,
        requiresReview: !options?.autoSubmit,
      },
    });

    return submission;
  } finally {
    await browser.close();
  }
}
