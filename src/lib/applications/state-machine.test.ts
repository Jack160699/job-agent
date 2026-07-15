import { describe, expect, it } from "vitest";
import {
  applicationTimeline,
  canTransitionApplication,
  nextApplicationAction,
} from "./state-machine";

describe("application state machine", () => {
  it("covers preparation, approval, submission, and hiring outcomes", () => {
    expect(canTransitionApplication("DISCOVERED", "ANALYZED")).toBe(true);
    expect(canTransitionApplication("ANALYZED", "MATCHED")).toBe(true);
    expect(canTransitionApplication("MATCHED", "RESUME_GENERATED")).toBe(true);
    expect(
      canTransitionApplication("PENDING_REVIEW", "AWAITING_APPROVAL")
    ).toBe(true);
    expect(
      canTransitionApplication("AWAITING_APPROVAL", "SUBMITTING")
    ).toBe(true);
    expect(canTransitionApplication("SUBMITTING", "SUBMITTED")).toBe(true);
    expect(canTransitionApplication("SUBMITTED", "INTERVIEWING")).toBe(true);
    expect(canTransitionApplication("INTERVIEWING", "OFFERED")).toBe(true);
    expect(canTransitionApplication("OFFERED", "ACCEPTED")).toBe(true);
  });

  it("prevents terminal states from replaying into submission", () => {
    expect(canTransitionApplication("ACCEPTED", "SUBMITTING")).toBe(false);
    expect(canTransitionApplication("REJECTED", "SUBMITTING")).toBe(false);
    expect(canTransitionApplication("WITHDRAWN", "SUBMITTING")).toBe(false);
    expect(canTransitionApplication("EXPIRED", "SUBMITTING")).toBe(false);
  });

  it("gives blockers an accurate next action", () => {
    expect(
      nextApplicationAction({
        status: "NEEDS_INFORMATION",
        hasDocuments: true,
      })
    ).toBe("Provide missing information");
    expect(
      nextApplicationAction({
        status: "BLOCKED_CAPTCHA",
        hasDocuments: true,
      })
    ).toContain("CAPTCHA");
    expect(
      nextApplicationAction({
        status: "BLOCKED_LOGIN",
        hasDocuments: true,
      })
    ).toContain("Sign in");
  });

  it("builds a chronological tracker timeline", () => {
    const timeline = applicationTimeline({
      createdAt: new Date("2026-07-15T10:00:00Z"),
      lastAttemptAt: new Date("2026-07-15T10:05:00Z"),
      submittedAt: new Date("2026-07-15T10:10:00Z"),
      updatedAt: new Date("2026-07-15T10:11:00Z"),
      status: "SUBMITTED",
    });
    expect(timeline.map((event) => event.label)).toEqual([
      "Application created",
      "Latest preparation attempt",
      "Submitted",
      "Current status: submitted",
    ]);
  });
});
