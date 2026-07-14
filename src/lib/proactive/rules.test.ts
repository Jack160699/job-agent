import { describe, expect, it } from "vitest";
import {
  buildRecommendationCandidates,
  prioritizeRecommendations,
  type RecommendationSnapshot,
} from "./rules";

const now = new Date("2026-07-15T08:00:00.000Z");

function snapshot(
  overrides: Partial<RecommendationSnapshot> = {}
): RecommendationSnapshot {
  return {
    preferencesComplete: true,
    hasResume: true,
    activeJobCount: 4,
    strongMatchCount: 0,
    lastSearchAt: new Date("2026-07-14T08:00:00.000Z"),
    pendingReviewCount: 0,
    unreadRecruiterReplies: 0,
    integrationReconnectRequired: false,
    ...overrides,
  };
}

describe("proactive recommendation rules", () => {
  it("grounds incomplete-profile guidance in missing fields", () => {
    const candidates = buildRecommendationCandidates(
      snapshot({ preferencesComplete: false, hasResume: false }),
      now
    );

    const rec = candidates.find((item) => item.type === "profile_incomplete");
    expect(rec?.priority).toBe("high");
    expect(rec?.evidence[0].value).toContain("master resume");
  });

  it("recommends a fresh search only when stale or empty", () => {
    expect(
      buildRecommendationCandidates(snapshot(), now).some(
        (item) => item.type === "search_stale"
      )
    ).toBe(false);

    const stale = buildRecommendationCandidates(
      snapshot({ lastSearchAt: new Date("2026-07-01T08:00:00.000Z") }),
      now
    );
    expect(stale.some((item) => item.type === "search_stale")).toBe(true);
  });

  it("creates evidence-backed match and review recommendations", () => {
    const candidates = buildRecommendationCandidates(
      snapshot({
        strongMatchCount: 2,
        strongestMatch: {
          title: "Backend Engineer",
          company: "Acme",
          score: 88,
        },
        pendingReviewCount: 1,
      }),
      now
    );

    expect(
      candidates.find((item) => item.type === "strong_match")?.evidence
    ).toContainEqual({ label: "Top match score", value: "88%" });
    expect(
      candidates.find((item) => item.type === "application_review")?.priority
    ).toBe("high");
  });

  it("only alerts for interviews within 72 hours", () => {
    const upcoming = buildRecommendationCandidates(
      snapshot({
        nextInterview: {
          title: "Technical interview",
          scheduledAt: new Date("2026-07-16T08:00:00.000Z"),
        },
      }),
      now
    );
    expect(upcoming.some((item) => item.type === "interview_approaching")).toBe(
      true
    );

    const distant = buildRecommendationCandidates(
      snapshot({
        nextInterview: {
          title: "Technical interview",
          scheduledAt: new Date("2026-07-20T08:00:00.000Z"),
        },
      }),
      now
    );
    expect(distant.some((item) => item.type === "interview_approaching")).toBe(
      false
    );
  });

  it("filters disabled categories and prioritizes high-impact items", () => {
    const candidates = buildRecommendationCandidates(
      snapshot({
        pendingReviewCount: 1,
        unreadRecruiterReplies: 1,
        integrationReconnectRequired: true,
      }),
      now
    );
    const prioritized = prioritizeRecommendations(
      candidates,
      ["communication"],
      2
    );

    expect(prioritized).toHaveLength(2);
    expect(prioritized.some((item) => item.category === "communication")).toBe(
      false
    );
    expect(prioritized[0].priority).toBe("high");
  });
});
