import { describe, it, expect } from "vitest";
import { getAutomatorForUrl, getAllAutomators } from "@/lib/automation/registry";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";

describe("automation registry", () => {
  it("has four provider automators and a review-only generic adapter", () => {
    expect(getAllAutomators()).toHaveLength(5);
  });

  it("routes greenhouse URLs", () => {
    const automator = getAutomatorForUrl(
      "https://boards.greenhouse.io/openai/jobs/123"
    );
    expect(automator?.platform).toBe("GREENHOUSE");
  });

  it("routes workday URLs", () => {
    const automator = getAutomatorForUrl(
      "https://company.wd1.myworkdayjobs.com/en-US/careers"
    );
    expect(automator?.platform).toBe("WORKDAY");
  });

  it("routes supported generic career forms last", () => {
    const automator = getAutomatorForUrl(
      "https://careers.example.com/jobs/software-engineer"
    );
    expect(automator?.platform).toBe("GENERIC_ATS");
    expect(automator?.canAutoApply).toBe(false);
  });
});

describe("resume PDF generation", () => {
  it("generates a valid PDF buffer", async () => {
    const pdf = await generateResumePdf({
      title: "Test Resume",
      rawText: "John Doe\nSoftware Engineer\nSkills: JavaScript, React",
      skills: ["JavaScript", "React"],
      highlights: ["Built scalable apps"],
    });
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
