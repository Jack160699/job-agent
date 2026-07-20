import { describe, expect, it } from "vitest";
import {
  applySafeFixAction,
  ensureSafeFixReview,
  type ReviewableGroundingReport,
} from "./safe-fix-review";

const context = {
  resumeId: "resume-1",
  resumeVersion: 2,
  userId: "user-1",
  rawText: "Led  customer onboarding and improved retention.",
};

function report(): ReviewableGroundingReport {
  return {
    claims: [
      {
        category: "responsibility",
        claim: "Led customer onboarding and improved retention.",
        sourceSection: "Experience",
        sourceExcerpt: "Led  customer onboarding and improved retention.",
        state: "AI_REWORDED",
        aiImproved: true,
        reviewRequired: true,
      },
    ],
  };
}

describe("safe-fix review", () => {
  it("creates stable, owner-bound proposals with deterministic validation", () => {
    const first = ensureSafeFixReview(report(), context);
    const second = ensureSafeFixReview(report(), context);
    expect(first.safeFixReview?.fixes.length).toBeGreaterThan(0);
    expect(first.safeFixReview?.fixes[0]).toMatchObject({
      resumeVersion: 2,
      userId: "user-1",
      status: "PENDING",
      deterministicValidation: { safe: true },
    });
    expect(first.safeFixReview?.fixes[0].id).toBe(
      second.safeFixReview?.fixes[0].id
    );
  });

  it("accepts once, preserves an action record, and is idempotent", () => {
    const initialized = ensureSafeFixReview(report(), context);
    const fixId = initialized.safeFixReview!.fixes[0].id;
    const accepted = applySafeFixAction({
      report: initialized,
      rawText: context.rawText,
      content: { summary: context.rawText },
      action: "ACCEPT",
      fixId,
      userId: context.userId,
      now: new Date("2026-07-20T00:00:00Z"),
    });
    expect(accepted.rawText).toBe(
      "Led customer onboarding and improved retention."
    );
    expect(accepted.report.safeFixReview?.fixes[0].status).toBe("ACCEPTED");
    expect(
      (accepted.content as { summary: string }).summary
    ).toBe("Led customer onboarding and improved retention.");

    const repeated = applySafeFixAction({
      report: accepted.report,
      rawText: accepted.rawText,
      content: accepted.content,
      action: "ACCEPT",
      fixId,
      userId: context.userId,
    });
    expect(repeated.changedContent).toBe(false);
  });

  it("rejects and supports idempotent undo of accepted fixes", () => {
    const initialized = ensureSafeFixReview(report(), context);
    const [firstFix, secondFix] = initialized.safeFixReview!.fixes;
    const rejected = applySafeFixAction({
      report: initialized,
      rawText: context.rawText,
      content: {},
      action: "REJECT",
      fixId: secondFix.id,
      userId: context.userId,
    });
    expect(
      rejected.report.safeFixReview?.fixes.find(
        (fix) => fix.id === secondFix.id
      )?.status
    ).toBe("REJECTED");

    const accepted = applySafeFixAction({
      report: rejected.report,
      rawText: context.rawText,
      content: {},
      action: "ACCEPT",
      fixId: firstFix.id,
      userId: context.userId,
    });
    const undone = applySafeFixAction({
      report: accepted.report,
      rawText: accepted.rawText,
      content: accepted.content,
      action: "UNDO_LAST",
      userId: context.userId,
    });
    expect(undone.rawText).toBe(context.rawText);
    expect(
      undone.report.safeFixReview?.fixes.find(
        (fix) => fix.id === firstFix.id
      )?.status
    ).toBe("PENDING");

    const repeated = applySafeFixAction({
      report: undone.report,
      rawText: undone.rawText,
      content: undone.content,
      action: "UNDO_LAST",
      userId: context.userId,
    });
    expect(repeated.changedContent).toBe(false);
  });

  it("blocks factual changes until explicit confirmation", () => {
    const factual = ensureSafeFixReview(
      {
        claims: [
          {
            category: "metric",
            claim: "Improved conversion by 50%",
            sourceSection: "Experience",
            sourceExcerpt: "Improved conversion",
            state: "AI_REWORDED",
          },
        ],
      },
      { ...context, rawText: "Improved conversion" }
    );
    const fix = factual.safeFixReview!.fixes[0];
    expect(fix.requiresConfirmation).toBe(true);
    expect(() =>
      applySafeFixAction({
        report: factual,
        rawText: "Improved conversion",
        content: {},
        action: "ACCEPT",
        fixId: fix.id,
        userId: context.userId,
      })
    ).toThrow("requires explicit factual confirmation");
  });
});
