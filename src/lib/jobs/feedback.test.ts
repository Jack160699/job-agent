import { describe, expect, it } from "vitest";
import {
  applyFeedbackProfile,
  buildFeedbackProfile,
} from "@/lib/jobs/feedback";
import type { JobFilterResult } from "@/lib/jobs/preferences";

const baseResult: JobFilterResult = {
  accepted: true,
  score: 75,
  classification: "POSSIBLE",
  reasons: ["Base preference match"],
  exclusions: [],
  concerns: [],
  uncertain: [],
  breakdown: {
    roleMatch: 90,
    skillMatch: 75,
    locationMatch: 85,
    salaryMatch: 50,
    experienceMatch: 85,
    seniorityMatch: 85,
    workModeMatch: 85,
    industryMatch: 50,
    employmentTypeMatch: 50,
    visaMatch: 50,
    freshnessScore: 75,
  },
  recommendation: "Possible match",
  classificationVersion: "test",
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
    expect(result.classification).toBe("STRONG");
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
      classification: "REJECTED" as const,
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
