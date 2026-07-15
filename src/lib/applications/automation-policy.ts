import type { ApplicationStatus } from "@prisma/client";
import type { SubmissionResult } from "@/lib/browser/types";

export type AutomationBlocker =
  | "needs_login"
  | "captcha_required"
  | "manual_required"
  | "missing_information"
  | "unsupported_platform"
  | "worker_unavailable"
  | "unknown";

export function classifyAutomationMessage(
  message: string
): AutomationBlocker {
  const text = message.toLowerCase();
  if (text.includes("login") || text.includes("sign in") || text.includes("sso")) {
    return "needs_login";
  }
  if (text.includes("captcha") || text.includes("challenge")) {
    return "captcha_required";
  }
  if (
    text.includes("manual") ||
    text.includes("human") ||
    text.includes("review")
  ) {
    return "manual_required";
  }
  if (text.includes("missing") || text.includes("invent")) {
    return "missing_information";
  }
  if (text.includes("unsupported") || text.includes("not supported")) {
    return "unsupported_platform";
  }
  if (text.includes("worker") || text.includes("browser bridge")) {
    return "worker_unavailable";
  }
  return "unknown";
}

export function mapSubmissionToApplicationStatus(
  submission: SubmissionResult,
  autoSubmit: boolean
): {
  status: ApplicationStatus;
  failureReason: string | null;
  message: string;
} {
  if (submission.status === "submitted") {
    return {
      status: "SUBMITTED",
      failureReason: null,
      message: submission.message || "Application submitted.",
    };
  }

  if (submission.status === "pending_review") {
    return {
      status: "AWAITING_APPROVAL",
      failureReason: null,
      message:
        submission.message ||
        "Application prepared and waiting for your review.",
    };
  }

  const blocker = classifyAutomationMessage(submission.message || "");
  if (blocker === "needs_login") {
    return {
      status: "BLOCKED_LOGIN",
      failureReason: "NEEDS_LOGIN",
      message:
        "This platform requires you to sign in. Complete login yourself, then ask Kairela to continue preparation.",
    };
  }
  if (blocker === "captcha_required") {
    return {
      status: "BLOCKED_CAPTCHA",
      failureReason: "CAPTCHA_REQUIRED",
      message:
        "A CAPTCHA or challenge appeared. Kairela will not bypass it. Complete the challenge yourself, then retry.",
    };
  }
  if (blocker === "missing_information") {
    return {
      status: "NEEDS_INFORMATION",
      failureReason: "NEEDS_INFORMATION",
      message:
        submission.message ||
        "Provide the missing information before Kairela continues. No answer was guessed.",
    };
  }
  if (blocker === "unsupported_platform") {
    return {
      status: "UNSUPPORTED",
      failureReason: "UNSUPPORTED_PLATFORM",
      message:
        submission.message ||
        "This platform is not supported for automated preparation. Apply manually.",
    };
  }
  if (blocker === "manual_required" || submission.status === "requires_manual") {
    return {
      status: "PENDING_REVIEW",
      failureReason: "MANUAL_REQUIRED",
      message:
        submission.message ||
        "This step needs your confirmation. No answers were invented.",
    };
  }

  return {
    status: "FAILED",
    failureReason: blocker.toUpperCase(),
    message:
      submission.message ||
      (autoSubmit
        ? "Authorized submission could not be completed."
        : "Application preparation could not be completed."),
  };
}
