import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "../../src/lib/browser/types";
import { fillCommonFields, findElement } from "../../src/lib/automation/base";
import { getAutomatorForUrl } from "../../src/lib/automation/registry";
import { answerCommonQuestions } from "../../src/lib/automation/questions";
import { uploadDocuments } from "../../src/lib/automation/documents";
import { withResilience } from "../../src/lib/automation/resilient";

export async function runPrepareApplicationTask(input: {
  browser: BrowserAutomationClient;
  jobUrl: string;
  profile: ApplicationProfile;
  documents: ApplicationDocuments;
  autoSubmit?: boolean;
  screenshotDir?: string;
  onProgress?: (progress: number) => Promise<void>;
}): Promise<SubmissionResult & { screenshotPaths: string[] }> {
  const screenshotPaths: string[] = [];
  const dir =
    input.screenshotDir || join(tmpdir(), "job-agent-browser-screenshots");
  await mkdir(dir, { recursive: true });

  const capture = async (label: string) => {
    const buf = await input.browser.screenshot();
    const path = join(dir, `${Date.now()}-${label}.png`);
    await writeFile(path, buf);
    screenshotPaths.push(path);
    return path;
  };

  const automator = getAutomatorForUrl(input.jobUrl);
  if (!automator) {
    return {
      success: false,
      status: "requires_manual",
      message: "No automator for this platform",
      screenshotPaths,
    };
  }

  await input.onProgress?.(10);

  await withResilience(
    () => input.browser.navigate(input.jobUrl),
    { label: "navigate", retries: 3, onRetry: () => capture("navigate-retry") }
  );
  await capture("loaded");
  await input.onProgress?.(25);

  await withResilience(
    () => input.browser.waitForSelector("Apply", 25000),
    { label: "wait-apply", retries: 2 }
  );

  const snap = await input.browser.snapshot();
  const applyBtn = findElement(snap, [
    /apply for this job/i,
    /start application/i,
    /apply/i,
    /submit application/i,
  ]);
  if (applyBtn) {
    await withResilience(() => input.browser.click(applyBtn.ref), {
      label: "click-apply",
      retries: 2,
    });
  }
  await capture("apply-clicked");
  await input.onProgress?.(40);

  await withResilience(() => fillCommonFields(input.browser, input.profile), {
    label: "fill-common",
    retries: 2,
  });

  const answered = await answerCommonQuestions(input.browser, input.profile);
  await uploadDocuments(input.browser, input.documents, dir);
  await capture("form-filled");
  await input.onProgress?.(70);

  if (answered.unanswered.length > 0) {
    return {
      success: false,
      status: "requires_manual",
      message: `Missing required information: ${answered.unanswered.join(", ")}. Kairela will not invent answers.`,
      formData: {
        answeredFields: answered.answered,
        unansweredFields: answered.unanswered,
      },
      screenshotPaths,
    };
  }

  const result = await automator.prepareApplication(
    input.browser,
    input.jobUrl,
    input.profile,
    input.documents,
    { autoSubmit: input.autoSubmit }
  );

  await capture("final");
  await input.onProgress?.(100);

  return { ...result, screenshotPaths };
}
