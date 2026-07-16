import { describe, expect, it } from "vitest";
import { parseResumeStructure } from "./parser";
import { extractCareerProfile, isCareerProfileGrounded } from "./career-profile";

const RESUME_TEXT = `Jane Doe
Software Engineer | jane.doe@email.com | Pune, India
https://linkedin.com/in/janedoe | https://github.com/janedoe

SUMMARY
Engineer with five years of experience building reliable web applications.

EXPERIENCE
Senior Software Engineer | Acme Corp | 2021 - Present
- Built TypeScript and React services backed by PostgreSQL.
- Led a team of 3 engineers.

Software Engineer | StartupXYZ | 2019 - 2021
- Developed frontend components with React.

EDUCATION
B.S. Computer Science | State University | 2019

SKILLS
TypeScript, React, PostgreSQL, Docker

CERTIFICATIONS
AWS Certified Solutions Architect
`;

function parse() {
  return parseResumeStructure(RESUME_TEXT, { mediaType: "text/plain", parser: "test" });
}

describe("extractCareerProfile", () => {
  it("extracts grounded personal details", () => {
    const profile = extractCareerProfile(parse());
    expect(profile.email.value).toBe("jane.doe@email.com");
    expect(profile.email.directlyFound).toBe(true);
    expect(profile.linkedinUrl.value).toBe("https://linkedin.com/in/janedoe");
    expect(profile.githubUrl.value).toBe("https://github.com/janedoe");
  });

  it("extracts work experience entries with titles and companies", () => {
    const profile = extractCareerProfile(parse());
    expect(profile.experience.value).toHaveLength(2);
    expect(profile.experience.value[0]).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme Corp",
      current: true,
    });
  });

  it("deduplicates job titles across current role and experience", () => {
    const profile = extractCareerProfile(parse());
    const lowerTitles = profile.jobTitles.value.map((t) => t.toLowerCase());
    const unique = new Set(lowerTitles);
    expect(unique.size).toBe(lowerTitles.length);
    expect(profile.jobTitles.value).toEqual(
      expect.arrayContaining(["Senior Software Engineer", "Software Engineer"])
    );
  });

  it("deduplicates skills", () => {
    const profile = extractCareerProfile(parse());
    const unique = new Set(profile.skills.value.map((s) => s.toLowerCase()));
    expect(unique.size).toBe(profile.skills.value.length);
  });

  it("extracts education without inventing fields", () => {
    const profile = extractCareerProfile(parse());
    expect(profile.education.value[0]).toMatchObject({
      degree: "B.S. Computer Science",
      institution: "State University",
      endDate: "2019",
    });
  });

  it("leaves missing fields null or empty rather than fabricating them", () => {
    const minimal = parseResumeStructure(
      `Alex Smith\n\nSKILLS\nPython, SQL, Data Engineering, Analytics, Automation, Reporting, Dashboards`,
      { mediaType: "text/plain", parser: "test" }
    );
    const profile = extractCareerProfile(minimal);
    expect(profile.email.value).toBeNull();
    expect(profile.phone.value).toBeNull();
    expect(profile.linkedinUrl.value).toBeNull();
    expect(profile.experience.value).toEqual([]);
    expect(profile.education.value).toEqual([]);
    expect(profile.certifications.value).toEqual([]);
  });

  it("does not compute experience years from a single ambiguous date", () => {
    const oneEntry = parseResumeStructure(
      `Sam Lee\n\nEXPERIENCE\nEngineer | Acme | 2022 - Present\n\nSKILLS\nGo, Rust, Cloud Infrastructure`,
      { mediaType: "text/plain", parser: "test" }
    );
    const profile = extractCareerProfile(oneEntry);
    // Only one date point resolves (2022, "present"); span is <2 distinct
    // years so it must not be silently reported as a confident fact.
    if (profile.experienceYears.value != null) {
      expect(profile.experienceYears.needsReview).toBe(true);
    }
  });

  it("marks computed (non-explicit) experience years for review", () => {
    const profile = extractCareerProfile(parse());
    if (!profile.experienceYears.directlyFound && profile.experienceYears.value != null) {
      expect(profile.experienceYears.needsReview).toBe(true);
    }
  });

  it("produces a grounded profile: every populated value traces to resume text", () => {
    const profile = extractCareerProfile(parse());
    expect(isCareerProfileGrounded(profile, RESUME_TEXT)).toBe(true);
  });

  it("marks extraction method as deterministic", () => {
    const profile = extractCareerProfile(parse());
    expect(profile.meta.extractionMethod).toBe("deterministic");
  });
});
