import type { ApplicationStatus } from "@prisma/client";

const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DISCOVERED: ["ANALYZED", "SKIPPED", "EXPIRED"],
  ANALYZED: ["MATCHED", "SKIPPED", "EXPIRED"],
  MATCHED: ["RESUME_GENERATED", "SKIPPED", "EXPIRED"],
  SKIPPED: ["MATCHED", "EXPIRED"],
  RESUME_GENERATED: [
    "COVER_LETTER_GENERATED",
    "PENDING_REVIEW",
    "NEEDS_INFORMATION",
    "EXPIRED",
  ],
  COVER_LETTER_GENERATED: [
    "PENDING_REVIEW",
    "NEEDS_INFORMATION",
    "EXPIRED",
  ],
  NEEDS_INFORMATION: ["PENDING_REVIEW", "AWAITING_APPROVAL", "EXPIRED"],
  AWAITING_APPROVAL: [
    "SUBMITTING",
    "PENDING_REVIEW",
    "NEEDS_INFORMATION",
    "BLOCKED_CAPTCHA",
    "BLOCKED_LOGIN",
    "EXPIRED",
    "WITHDRAWN",
  ],
  BLOCKED_CAPTCHA: ["PENDING_REVIEW", "AWAITING_APPROVAL", "WITHDRAWN"],
  BLOCKED_LOGIN: ["PENDING_REVIEW", "AWAITING_APPROVAL", "WITHDRAWN"],
  UNSUPPORTED: ["PENDING_REVIEW", "WITHDRAWN"],
  EXPIRED: ["WITHDRAWN"],
  PENDING_REVIEW: [
    "AWAITING_APPROVAL",
    "NEEDS_INFORMATION",
    "SUBMITTING",
    "BLOCKED_CAPTCHA",
    "BLOCKED_LOGIN",
    "UNSUPPORTED",
    "FAILED",
    "EXPIRED",
    "WITHDRAWN",
  ],
  SUBMITTING: [
    "SUBMITTED",
    "NEEDS_INFORMATION",
    "BLOCKED_CAPTCHA",
    "BLOCKED_LOGIN",
    "FAILED",
    "WITHDRAWN",
  ],
  SUBMITTED: ["INTERVIEWING", "OFFERED", "REJECTED", "WITHDRAWN"],
  FAILED: [
    "PENDING_REVIEW",
    "AWAITING_APPROVAL",
    "SUBMITTING",
    "NEEDS_INFORMATION",
    "EXPIRED",
    "WITHDRAWN",
  ],
  WITHDRAWN: [],
  INTERVIEWING: ["OFFERED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  REJECTED: [],
  ACCEPTED: [],
};

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus
) {
  return from === to || TRANSITIONS[from].includes(to);
}

export function nextApplicationAction(input: {
  status: ApplicationStatus;
  hasDocuments: boolean;
  failureReason?: string | null;
}) {
  if (!input.hasDocuments) return "Generate tailored documents";
  switch (input.status) {
    case "NEEDS_INFORMATION":
      return "Provide missing information";
    case "AWAITING_APPROVAL":
    case "PENDING_REVIEW":
      return "Review and authorize";
    case "BLOCKED_CAPTCHA":
      return "Complete CAPTCHA manually, then retry";
    case "BLOCKED_LOGIN":
      return "Sign in manually, then retry";
    case "UNSUPPORTED":
      return "Open the posting and apply manually";
    case "FAILED":
      return input.failureReason === "CANCELLED_BY_USER"
        ? "Retry preparation"
        : "Review failure and retry";
    case "SUBMITTING":
      return "Preparation is running";
    case "SUBMITTED":
      return "Track employer response";
    case "INTERVIEWING":
      return "Prepare for interview";
    case "OFFERED":
      return "Review offer";
    case "EXPIRED":
      return "Posting expired";
    default:
      return "Continue application";
  }
}

export function applicationTimeline(input: {
  createdAt: Date;
  lastAttemptAt?: Date | null;
  submittedAt?: Date | null;
  updatedAt: Date;
  status: ApplicationStatus;
}) {
  return [
    { label: "Application created", at: input.createdAt },
    ...(input.lastAttemptAt
      ? [{ label: "Latest preparation attempt", at: input.lastAttemptAt }]
      : []),
    ...(input.submittedAt
      ? [{ label: "Submitted", at: input.submittedAt }]
      : []),
    {
      label: `Current status: ${input.status.replaceAll("_", " ").toLowerCase()}`,
      at: input.updatedAt,
    },
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
