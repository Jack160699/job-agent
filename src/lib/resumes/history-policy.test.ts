import { describe, expect, it } from "vitest";
import {
  REMOVED_MASTER_LABEL,
  canUseSurvivingTailoredResume,
  tailoredResumeDeletionPolicy,
} from "./history-policy";

describe("resume history policy", () => {
  it("keeps owner access after the original master is removed", () => {
    expect(REMOVED_MASTER_LABEL).toBe("Original master resume was removed.");
    expect(
      canUseSurvivingTailoredResume({
        ownerId: "user-a",
        requesterId: "user-a",
        rawText: "Durable tailored resume",
      })
    ).toBe(true);
  });

  it("does not grant another user access to a surviving document", () => {
    expect(
      canUseSurvivingTailoredResume({
        ownerId: "user-a",
        requesterId: "user-b",
        rawText: "Durable tailored resume",
      })
    ).toBe(false);
  });

  it.each(["SUBMITTED", "INTERVIEWING", "OFFERED", "ACCEPTED"])(
    "requires preservation for %s applications",
    (status) => {
      expect(tailoredResumeDeletionPolicy(status)).toMatchObject({
        allowed: false,
        code: "DOCUMENT_PRESERVATION_REQUIRED",
      });
    }
  );

  it("allows deletion for an unsubmitted document", () => {
    expect(tailoredResumeDeletionPolicy("PENDING_REVIEW").allowed).toBe(true);
  });
});
