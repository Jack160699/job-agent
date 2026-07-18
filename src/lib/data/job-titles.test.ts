import { describe, expect, it } from "vitest";
import { searchJobTitles, JOB_TITLES } from "./job-titles";

describe("searchJobTitles", () => {
  it('returns Software Engineer for "Software"', () => {
    expect(searchJobTitles("Software")).toContain("Software Engineer");
  });

  it("is case-insensitive", () => {
    expect(searchJobTitles("backend")).toContain("Backend Developer");
  });

  it("returns an empty array for an empty query", () => {
    expect(searchJobTitles("")).toEqual([]);
  });

  it("has no duplicate titles", () => {
    expect(new Set(JOB_TITLES).size).toBe(JOB_TITLES.length);
  });
});
