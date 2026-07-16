import { describe, expect, it } from "vitest";
import { groundAiProfile, enhanceCareerProfileWithAI } from "./career-profile-ai";
import { extractCareerProfile } from "./career-profile";
import { parseResumeStructure } from "./parser";

const RAW_TEXT = `Jordan Rivera
Backend Engineer at Acme

EXPERIENCE
Backend Engineer | Acme | 2020 - Present

SKILLS
Python, PostgreSQL`;

describe("groundAiProfile", () => {
  it("drops fabricated scalar and array values not present in the resume", () => {
    const grounded = groundAiProfile(
      {
        fullName: "Jordan Rivera",
        email: "jordan@fabricated.example", // not in resume text
        phone: null,
        currentLocation: "San Francisco, CA", // not in resume text
        professionalSummary: "A short paraphrase",
        currentRole: "Backend Engineer",
        jobTitles: ["Backend Engineer", "Chief Astronaut"], // second is fabricated
        experienceYears: 4,
        skills: ["Python", "Quantum Computing"], // second is fabricated
        certifications: ["AWS Certified"], // fabricated, not in resume
        languages: [],
        linkedinUrl: "https://linkedin.com/in/jordanrivera", // fabricated, not in resume
        githubUrl: null,
        portfolioUrl: null,
      },
      RAW_TEXT
    );

    expect(grounded.fullName).toBe("Jordan Rivera");
    expect(grounded.email).toBeNull();
    expect(grounded.currentLocation).toBeNull();
    expect(grounded.jobTitles).toEqual(["Backend Engineer"]);
    expect(grounded.skills).toEqual(["Python"]);
    expect(grounded.certifications).toEqual([]);
    expect(grounded.linkedinUrl).toBeNull();
  });

  it("keeps values that are literally present in the resume text", () => {
    const grounded = groundAiProfile(
      {
        fullName: "Jordan Rivera",
        email: null,
        phone: null,
        currentLocation: null,
        professionalSummary: null,
        currentRole: "Backend Engineer",
        jobTitles: ["Backend Engineer"],
        experienceYears: null,
        skills: ["Python", "PostgreSQL"],
        certifications: [],
        languages: [],
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
      },
      RAW_TEXT
    );

    expect(grounded.currentRole).toBe("Backend Engineer");
    expect(grounded.skills).toEqual(["Python", "PostgreSQL"]);
  });
});

describe("enhanceCareerProfileWithAI", () => {
  it("falls back gracefully to the deterministic profile when AI credentials are unavailable", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const parsed = parseResumeStructure(RAW_TEXT, { mediaType: "text/plain", parser: "test" });
      const deterministic = extractCareerProfile(parsed);
      const enhanced = await enhanceCareerProfileWithAI(deterministic, RAW_TEXT);
      expect(enhanced).toEqual(deterministic);
      expect(enhanced.meta.extractionMethod).toBe("deterministic");
    } finally {
      if (original) process.env.OPENAI_API_KEY = original;
    }
  });
});
