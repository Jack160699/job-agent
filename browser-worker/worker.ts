import { PrismaClient, type ApplicationStatus, type Prisma } from "@prisma/client";
import { createBrowserClient } from "../../src/lib/browser/client";
import { browserQueue } from "./queue/manager";
import { runPrepareApplicationTask } from "./automation/runner";

const prisma = new PrismaClient();
const POLL_MS = Number(process.env.BROWSER_WORKER_POLL_MS || 3000);
const CONCURRENCY = Number(process.env.BROWSER_WORKER_CONCURRENCY || 1);

async function processTask(taskId: string) {
  const task = await prisma.browserTask.findUniqueOrThrow({
    where: { id: taskId },
  });

  const payload = (task.payload || {}) as Record<string, unknown>;
  const browser = await createBrowserClient();

  try {
    if (task.type === "PREPARE_APPLICATION") {
      const applicationId = task.applicationId || (payload.applicationId as string);
      if (!applicationId) throw new Error("applicationId required");

      const application = await prisma.application.findFirst({
        where: { id: applicationId, userId: task.userId },
        include: {
          job: true,
          tailoredResume: true,
          coverLetter: true,
        },
      });
      if (!application) throw new Error("Application not found");

      const user = await prisma.user.findUnique({ where: { id: task.userId } });
      const settings = await prisma.userSettings.findUnique({
        where: { userId: task.userId },
      });
      const resumeText =
        application.tailoredResume?.rawText ||
        (await prisma.masterResume.findUnique({ where: { userId: task.userId } }))
          ?.rawText ||
        "";

      const result = await runPrepareApplicationTask({
        browser,
        jobUrl: application.job.sourceUrl,
        profile: {
          fullName: user?.fullName || user?.email || "Applicant",
          email: user?.email || "",
          linkedinUrl: user?.linkedinUrl || undefined,
          location: user?.currentLocation || settings?.locations?.[0],
          experienceYears: settings?.experienceYears,
          salaryMin: settings?.salaryMin,
          salaryMax: settings?.salaryMax,
          salaryCurrency: settings?.salaryCurrency,
          visaSponsorshipRequired: settings?.visaSponsorshipRequired,
          willingToRelocate: settings?.willingToRelocate,
          noticePeriodDays: settings?.noticePeriodDays,
          workModes: settings?.workModes as
            | Array<"REMOTE" | "HYBRID" | "ONSITE">
            | undefined,
        },
        documents: {
          resumeText,
          coverLetterText: application.coverLetter?.content,
        },
        autoSubmit: Boolean(payload.autoSubmit),
        onProgress: (p) => browserQueue.updateProgress(taskId, p),
      });

      const newStatus: ApplicationStatus =
        result.status === "submitted"
          ? "SUBMITTED"
          : result.status === "failed"
            ? "FAILED"
            : "PENDING_REVIEW";

      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: newStatus,
          submittedAt: newStatus === "SUBMITTED" ? new Date() : undefined,
          formData: result.formData as Prisma.InputJsonValue,
          failureReason: result.success ? null : result.message,
          requiresReview: !payload.autoSubmit,
        },
      });

      await browserQueue.complete(taskId, {
        ...result,
        screenshotPaths: result.screenshotPaths,
      });
      return;
    }

    throw new Error(`Unsupported browser task type: ${task.type}`);
  } catch (error) {
    let screenshotPath: string | undefined;
    try {
      const buf = await browser.screenshot();
      screenshotPath = `worker-error-${Date.now()}.png`;
      const { writeFile, mkdir } = await import("fs/promises");
      const { join } = await import("path");
      const dir = join(process.cwd(), "browser-worker", "screenshots");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, screenshotPath), buf);
    } catch {
      // ignore screenshot failure
    }

    const message = error instanceof Error ? error.message : String(error);
    await browserQueue.fail(taskId, message, screenshotPath ? [screenshotPath] : undefined);
  } finally {
    await browser.close();
  }
}

async function poll() {
  const tasks = await browserQueue.claimNext(CONCURRENCY);
  await Promise.all(tasks.map((t) => processTask(t.id)));
}

export async function startBrowserWorker() {
  console.log("[Browser Worker] starting...");
  console.log(`[Browser Worker] poll=${POLL_MS}ms concurrency=${CONCURRENCY}`);
  console.log(
    `[Browser Worker] bridge=${process.env.BROWSER_MCP_BRIDGE_URL || "local playwright"}`
  );

  await poll();
  setInterval(() => {
    poll().catch((err) => console.error("[Browser Worker] poll error:", err));
  }, POLL_MS);
}

if (require.main === module) {
  startBrowserWorker().catch((err) => {
    console.error("[Browser Worker] fatal:", err);
    process.exit(1);
  });
}
