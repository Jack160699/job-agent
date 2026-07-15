import { tmpdir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import { fillCommonFields, findElement } from "@/lib/automation/base";
import { answerCommonQuestions } from "@/lib/automation/questions";
import { uploadDocuments } from "@/lib/automation/documents";

/**
 * Shared grounded prepare path for both browser-worker and in-process orchestration.
 * Never invents answers. Never re-enters platform adapters after the form is filled.
 */
export async function prepareApplicationForm(input: {
  browser: BrowserAutomationClient;
  jobUrl: string;
  platform: string;
  profile: ApplicationProfile;
  documents: ApplicationDocuments;
  autoSubmit?: boolean;
  shouldContinue?: () => Promise<boolean>;
}): Promise<SubmissionResult> {
  const continueOrStop = async () => {
    if (input.shouldContinue && !(await input.shouldContinue())) {
      return {
        success: false,
        status: "failed" as const,
        message: "Automation cancelled before completion",
        formData: { cancelled: true },
      };
    }
    return null;
  };

  const cancelled = await continueOrStop();
  if (cancelled) return cancelled;

  await input.browser.navigate(input.jobUrl);
  await input.browser.waitForSelector("Apply", 5000).catch(() => undefined);

  const snap = await input.browser.snapshot();
  const applyBtn = findElement(snap, [
    /apply for this job/i,
    /start application/i,
    /apply/i,
    /submit application/i,
  ]);
  if (applyBtn) await input.browser.click(applyBtn.ref);

  const cancelledAfterApply = await continueOrStop();
  if (cancelledAfterApply) return cancelledAfterApply;

  const handoff = detectRestrictedHandoff(await input.browser.snapshot());
  if (handoff) {
    return {
      success: false,
      status: "requires_manual",
      message: handoff,
      formData: { platform: input.platform, jobUrl: input.jobUrl },
    };
  }

  await fillCommonFields(input.browser, input.profile);
  const answered = await answerCommonQuestions(input.browser, input.profile);
  const uploadDir = join(tmpdir(), "job-agent-uploads");
  await mkdir(uploadDir, { recursive: true });
  await uploadDocuments(
    input.browser,
    input.documents,
    uploadDir
  );

  if (answered.unanswered.length > 0) {
    return {
      success: false,
      status: "requires_manual",
      message: `Missing required information: ${answered.unanswered.join(", ")}. Kairela will not invent answers.`,
      formData: {
        answeredFields: answered.answered,
        unansweredFields: answered.unanswered,
        platform: input.platform,
        jobUrl: input.jobUrl,
      },
    };
  }

  const formData = {
    platform: input.platform,
    jobUrl: input.jobUrl,
    profile: input.profile.email,
    answeredFields: answered.answered,
  };

  if (!input.autoSubmit) {
    return {
      success: true,
      status: "pending_review",
      message: `${input.platform} application filled — ready for review`,
      formData,
    };
  }

  const cancelledBeforeSubmit = await continueOrStop();
  if (cancelledBeforeSubmit) return cancelledBeforeSubmit;

  const submitBtn = findElement(await input.browser.snapshot(), [
    /submit application/i,
    /submit/i,
  ]);
  if (!submitBtn) {
    return {
      success: false,
      status: "requires_manual",
      message: "Could not find submit button after grounding checks",
      formData,
    };
  }

  await input.browser.click(submitBtn.ref);
  return {
    success: true,
    status: "submitted",
    message: `${input.platform} application submitted`,
    formData,
  };
}

export function detectRestrictedHandoff(snapshot: {
  elements: Array<{ name?: string; role?: string; tag?: string }>;
}) {
  const pageText = snapshot.elements
    .map((element) => `${element.name ?? ""} ${element.role ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (/captcha|recaptcha|hcaptcha|security challenge/.test(pageText)) {
    return "CAPTCHA challenge requires manual completion. Kairela will not bypass it.";
  }
  if (
    /sign in to (continue|apply)|log in to (continue|apply)|sso required/.test(
      pageText
    )
  ) {
    return "Login required. Sign in yourself, then retry preparation.";
  }
  return null;
}
