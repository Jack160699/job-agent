export const REMOVED_MASTER_LABEL = "Original master resume was removed.";

const PRESERVED_APPLICATION_STATUSES = new Set([
  "SUBMITTED",
  "INTERVIEWING",
  "OFFERED",
  "ACCEPTED",
]);

export function tailoredResumeDeletionPolicy(applicationStatus?: string | null) {
  if (
    applicationStatus &&
    PRESERVED_APPLICATION_STATUSES.has(applicationStatus)
  ) {
    return {
      allowed: false,
      code: "DOCUMENT_PRESERVATION_REQUIRED" as const,
      message:
        "This document is part of an active or submitted application and must be preserved. Archive it instead.",
    };
  }
  return { allowed: true, code: null, message: null };
}

export function canUseSurvivingTailoredResume(input: {
  ownerId: string;
  requesterId: string;
  rawText: string;
}) {
  return (
    input.ownerId === input.requesterId && input.rawText.trim().length > 0
  );
}
