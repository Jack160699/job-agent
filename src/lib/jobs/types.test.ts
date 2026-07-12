import { describe, it, expect } from "vitest";
import { detectJobSource } from "@/lib/jobs/types";

describe("detectJobSource", () => {
  it("detects LinkedIn", () => {
    expect(detectJobSource("https://www.linkedin.com/jobs/view/123")).toBe(
      "LINKEDIN"
    );
  });

  it("detects Greenhouse", () => {
    expect(
      detectJobSource("https://boards.greenhouse.io/company/jobs/123")
    ).toBe("GREENHOUSE");
  });

  it("detects Lever", () => {
    expect(detectJobSource("https://jobs.lever.co/company/abc")).toBe("LEVER");
  });

  it("detects Indeed", () => {
    expect(detectJobSource("https://www.indeed.com/viewjob?jk=abc")).toBe(
      "INDEED"
    );
  });

  it("detects Ashby", () => {
    expect(detectJobSource("https://jobs.ashbyhq.com/linear/abc")).toBe("ASHBY");
  });

  it("detects Workday", () => {
    expect(
      detectJobSource("https://company.wd1.myworkdayjobs.com/en-US/careers")
    ).toBe("WORKDAY");
  });

  it("defaults to company portal", () => {
    expect(detectJobSource("https://careers.example.com/jobs/123")).toBe(
      "COMPANY_PORTAL"
    );
  });
});
