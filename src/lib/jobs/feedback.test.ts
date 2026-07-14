import { describe, expect, it } from "vitest";
import {
  applyFeedbackProfile,
  buildFeedbackProfile,
} from "@/lib/jobs/feedback";
import type { JobFilterResult } from "@/lib/jobs/preferences";

const baseResult: JobFilterResult = {
  accepted: true,
  score: 75,
  classification: "POSSIBLE_MATCH",
  reasons: ["Base preference match"],
  exclusions: [],
  concerns: [],
  breakdown: {
    roleMatch: 90,
    skillMatch: 75,
    locationMatch: 85,
    salaryMatch: 50,
    experienceMatch: 85,
    freshnessScore: 75,
  },
  recommendation: "Possible match",
};

describe("job feedback ranking", () => {
  it("boosts exact role and company patterns marked relevant", () => {
    const profile = buildFeedbackProfile([
      {
        relevant: true,
        reason: "good_match",
        job: { title: "Platform Engineer", company: "Acme" },
      },
    ]);
    const result = applyFeedbackProfile(
      baseResult,
      {
        source: "LEVER",
        sourceUrl: "https://example.com/job",
        title: "Platform Engineer",
        company: "Acme",
        description: "Platform role",
      },
      profile,
      70
    );

    expect(result.score).toBe(81);
    expect(result.classification).toBe("STRONG_MATCH");
  });

  it("can exclude an exact role repeatedly marked wrong", () => {
    const profile = buildFeedbackProfile([
      {
        relevant: false,
        reason: "wrong_role",
        job: { title: "Platform Engineer", company: "Acme" },
      },
    ]);
    const result = applyFeedbackProfile(
      baseResult,
      {
        source: "LEVER",
        sourceUrl: "https://example.com/job",
        title: "Platform Engineer",
        company: "Different Company",
        description: "Platform role",
      },
      profile,
      70
    );

    expect(result.accepted).toBe(false);
    expect(result.exclusions).toContain(
      "Similar roles were marked not relevant"
    );
  });

  it("does not override a hard preference rejection", () => {
    const rejected = {
      ...baseResult,
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES" as const,
    };
    const profile = buildFeedbackProfile([
      {
        relevant: true,
        reason: "good_match",
        job: { title: "Platform Engineer", company: "Acme" },
      },
    ]);

    expect(
      applyFeedbackProfile(
        rejected,
        {
          source: "LEVER",
          sourceUrl: "https://example.com/job",
          title: "Platform Engineer",
          company: "Acme",
          description: "",
        },
        profile,
        70
      )
    ).toEqual(rejected);
  });
});
