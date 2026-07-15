import { describe, expect, it } from "vitest";

/**
 * Document readiness gate used by application UI/actions.
 * Kept pure so journey recovery stays testable without Prisma.
 */
export function applicationHasReadyDocuments(input: {
  tailoredResumeId?: string | null;
  coverLetterId?: string | null;
}) {
  return Boolean(input.tailoredResumeId && input.coverLetterId);
}

export function canPrepareApplication(input: {
  status: string;
  hasDocuments: boolean;
}) {
  if (!input.hasDocuments) return false;
  return [
    "PENDING_REVIEW",
    "RESUME_GENERATED",
    "COVER_LETTER_GENERATED",
    "FAILED",
  ].includes(input.status);
}

describe("application document readiness", () => {
  it("requires both tailored resume and cover letter", () => {
    expect(
      applicationHasReadyDocuments({
        tailoredResumeId: "r1",
        coverLetterId: null,
      })
    ).toBe(false);
    expect(
      applicationHasReadyDocuments({
        tailoredResumeId: "r1",
        coverLetterId: "c1",
      })
    ).toBe(true);
  });

  it("blocks prepare until documents exist", () => {
    expect(
      canPrepareApplication({ status: "MATCHED", hasDocuments: false })
    ).toBe(false);
    expect(
      canPrepareApplication({ status: "PENDING_REVIEW", hasDocuments: true })
    ).toBe(true);
  });
});
