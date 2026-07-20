import { describe, expect, it } from "vitest";
import {
  buildFilterImpact,
  buildZeroResultDiagnosis,
  categorizeExclusionReason,
  type DiagnosisInput,
  type RecoveryActionId,
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
    expect(diagnosis.suggestedActions).toEqual([
      "retry_sources",
      "review_sources",
    ]);
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

  const matrixCases: Array<
    [string, Partial<DiagnosisInput>, RegExp, RecoveryActionId]
  > = [
    ["Exact title too narrow", { discovered: 8, excludedCount: 8, filterImpact: { title_mismatch: 8 } }, /target roles/i, "lower_match_threshold"],
    ["Preferred city unavailable", { discovered: 7, excludedCount: 7, filterImpact: { location_mismatch: 7 } }, /preferred locations/i, "include_remote"],
    ["Minimum salary too high", { discovered: 4, excludedCount: 4, filterImpact: { salary_below_minimum: 4 } }, /minimum/i, "reduce_salary_minimum"],
    ["Experience mismatch", { discovered: 6, excludedCount: 6, filterImpact: { experience_mismatch: 6 } }, /experience/i, "review_preferences"],
    ["All selected sources failed", { sources: [{ source: "GREENHOUSE", success: false, fetched: 0 }, { source: "LEVER", success: false, fetched: 0 }] }, /all 2 job sources failed/i, "retry_sources"],
    ["LinkedIn unavailable", { sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "not configured" }, { source: "GREENHOUSE", success: true, fetched: 0 }] }, /linkedin public discovery is not configured/i, "review_sources"],
    ["Naukri unavailable", { sources: [{ source: "NAUKRI", success: false, fetched: 0, error: "setup_required" }, { source: "LEVER", success: true, fetched: 0 }] }, /naukri public discovery is not configured/i, "review_sources"],
    ["Provider rate limited", { sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "provider rate limited" }, { source: "LEVER", success: true, fetched: 0 }] }, /rate limited/i, "retry_sources"],
    ["Provider quota exhausted", { sources: [{ source: "NAUKRI", success: false, fetched: 0, error: "quota exhausted" }, { source: "ASHBY", success: true, fetched: 0 }] }, /quota/i, "retry_sources"],
    ["ATS board timeout", { sources: [{ source: "WORKDAY", success: false, fetched: 0, error: "timed out" }, { source: "LEVER", success: true, fetched: 0 }] }, /safe timeout/i, "retry_sources"],
    ["Government deadline expired", { discovered: 3, excludedCount: 3, filterImpact: { expired_or_removed: 3 } }, /expired/i, "retry_sources"],
    ["Qualification mismatch", { discovered: 2, excludedCount: 2, filterImpact: { qualification_mismatch: 2 } }, /qualification/i, "review_profile"],
    ["Duplicate-only results", { discovered: 5, duplicates: 5 }, /duplicates/i, "view_existing_jobs"],
    ["No recent jobs", { discovered: 9, excludedCount: 9, filterImpact: { stale_posting: 9 } }, /old/i, "retry_sources"],
    ["Excluded keyword removed everything", { discovered: 5, excludedCount: 5, filterImpact: { excluded_keyword: 5 } }, /excluded keyword/i, "review_preferences"],
    ["Authenticated source disconnected", { sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "authenticated connection required" }, { source: "GREENHOUSE", success: true, fetched: 0 }] }, /authenticated connection/i, "review_sources"],
    ["Target title missing", { plan: { titles: [], locations: ["Pune"] } }, /no target role/i, "review_profile"],
    ["Location missing", { plan: { titles: ["Teacher"], locations: [] } }, /no preferred location/i, "include_remote"],
    ["Government category too narrow", { plan: { titles: ["Government archaeology officer"], locations: ["India"] } }, /no current postings/i, "review_preferences"],
    ["Healthcare market empty in selected city", { plan: { titles: ["Staff Nurse"], locations: ["Panaji"] } }, /staff nurse.*panaji/i, "include_remote"],
  ];

  it.each(matrixCases)(
    "covers matrix scenario: %s",
    (_name, overrides, expectedText, expectedAction) => {
      const diagnosis = buildZeroResultDiagnosis({
        discovered: 0,
        excludedCount: 0,
        duplicates: 0,
        filterImpact: {},
        sources: [{ source: "GREENHOUSE", success: true, fetched: 0 }],
        plan: { titles: ["Operations Analyst"], locations: ["Pune"] },
        ...overrides,
      });
      expect(diagnosis.explanation.join(" ")).toMatch(expectedText);
      expect(diagnosis.suggestedActions).toContain(expectedAction);
    }
  );
});
