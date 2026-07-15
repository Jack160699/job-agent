import { describe, expect, it } from "vitest";
import {
  hasRequiredApplicationDocuments,
  preparationReuseDecision,
  shouldResumePreparation,
} from "./preparation-state";

describe("application preparation persistence", () => {
  it("reattaches after refresh while preparation is pending or running", () => {
    expect(
      shouldResumePreparation({
        browserTaskId: "task-1",
        applicationStatus: "PENDING_REVIEW",
      })
    ).toBe(true);
    expect(
      shouldResumePreparation({
        browserTaskId: "task-1",
        applicationStatus: "SUBMITTING",
        taskStatus: "running",
      })
    ).toBe(true);
  });

  it("stops polling terminal deliveries", () => {
    for (const taskStatus of [
      "completed",
      "failed",
      "cancelled",
      "dead_letter",
    ]) {
      expect(
        shouldResumePreparation({
          browserTaskId: "task-1",
          applicationStatus: "SUBMITTING",
          taskStatus,
        })
      ).toBe(false);
    }
  });

  it("requires both tailored documents", () => {
    expect(
      hasRequiredApplicationDocuments({
        tailoredResumeId: "resume-1",
        coverLetterId: "letter-1",
      })
    ).toBe(true);
    expect(
      hasRequiredApplicationDocuments({
        tailoredResumeId: "resume-1",
        coverLetterId: null,
      })
    ).toBe(false);
  });

  it("reuses active, submitted, and already prepared attempts", () => {
    expect(
      preparationReuseDecision({
        applicationStatus: "SUBMITTED",
        autoSubmit: true,
        hasPersistedFormData: true,
      })
    ).toBe("already_submitted");
    expect(
      preparationReuseDecision({
        applicationStatus: "PENDING_REVIEW",
        autoSubmit: false,
        hasPersistedFormData: false,
        activeTaskId: "task-1",
      })
    ).toBe("active_delivery");
    expect(
      preparationReuseDecision({
        applicationStatus: "AWAITING_APPROVAL",
        autoSubmit: false,
        hasPersistedFormData: true,
      })
    ).toBe("already_prepared");
  });
});
