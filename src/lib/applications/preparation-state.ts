export function shouldResumePreparation(input: {
  browserTaskId?: string | null;
  applicationStatus: string;
  taskStatus?: string | null;
}) {
  if (!input.browserTaskId) return false;
  if (
    input.taskStatus &&
    ["completed", "failed", "cancelled", "dead_letter"].includes(
      input.taskStatus
    )
  ) {
    return false;
  }
  return ["PENDING_REVIEW", "SUBMITTING"].includes(input.applicationStatus);
}

export function hasRequiredApplicationDocuments(input: {
  tailoredResumeId?: string | null;
  coverLetterId?: string | null;
}) {
  return Boolean(input.tailoredResumeId && input.coverLetterId);
}

export function preparationReuseDecision(input: {
  applicationStatus: string;
  autoSubmit: boolean;
  hasPersistedFormData: boolean;
  activeTaskId?: string | null;
}) {
  if (input.applicationStatus === "SUBMITTED") return "already_submitted";
  if (input.activeTaskId) return "active_delivery";
  if (
    !input.autoSubmit &&
    input.applicationStatus === "AWAITING_APPROVAL" &&
    input.hasPersistedFormData
  ) {
    return "already_prepared";
  }
  if (input.autoSubmit && input.applicationStatus === "SUBMITTING") {
    return "active_delivery";
  }
  return null;
}
