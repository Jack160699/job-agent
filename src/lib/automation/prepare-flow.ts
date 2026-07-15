import { tmpdir } from "os";
import { join } from "path";
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
  await input.browser.waitForSelector("Apply", 25000);

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

  await fillCommonFields(input.browser, input.profile);
  const answered = await answerCommonQuestions(input.browser, input.profile);
  await uploadDocuments(
    input.browser,
    input.documents,
    join(tmpdir(), "job-agent-uploads")
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
