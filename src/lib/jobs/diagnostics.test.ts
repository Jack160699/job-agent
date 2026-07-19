import { describe, expect, it } from "vitest";
import {
  buildFilterImpact,
  buildZeroResultDiagnosis,
  categorizeExclusionReason,
} from "./diagnostics";

describe("zero-result diagnostics", () => {
  it("categorizes the real preference exclusion messages", () => {
    expect(categorizeExclusionReason("Location mismatch")).toBe(
      "location_mismatch"
    );
    expect(
      categorizeExclusionReason("Salary 400000 INR is below minimum 800000 INR")
    ).toBe("salary_below_minimum");
    expect(
      categorizeExclusionReason("Match score 42 below threshold 70")
    ).toBe("below_match_threshold");
  });

  it("counts every filter impact instead of dropping secondary causes", () => {
    expect(
      buildFilterImpact([
        "Location mismatch",
        "Location mismatch",
        "Missing required skills",
      ])
    ).toEqual({ location_mismatch: 2, missing_skills: 1 });
  });

  it("explains a total source failure and provides retry", () => {
    const diagnosis = buildZeroResultDiagnosis({
      discovered: 0,
      excludedCount: 0,
      duplicates: 0,
      filterImpact: {},
      sources: [
        { source: "GREENHOUSE", success: false, fetched: 0 },
        { source: "LEVER", success: false, fetched: 0 },
      ],
      plan: { titles: ["Operations Analyst"], locations: ["Pune"] },
    });
    expect(diagnosis.explanation[0]).toContain("All 2 job sources failed");
    expect(diagnosis.suggestedActions).toEqual(["retry_sources"]);
  });

  it("explains the largest filter cause deterministically", () => {
    const input = {
      discovered: 42,
      excludedCount: 42,
      duplicates: 0,
      filterImpact: { location_mismatch: 40, salary_below_minimum: 2 },
      sources: [{ source: "GREENHOUSE", success: true, fetched: 42 }],
      plan: { titles: ["Operations Analyst"], locations: ["Pune"] },
    };
    expect(buildZeroResultDiagnosis(input)).toEqual(
      buildZeroResultDiagnosis(input)
    );
    expect(buildZeroResultDiagnosis(input).explanation[0]).toContain("40 jobs");
  });
});
