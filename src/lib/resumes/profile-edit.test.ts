import { describe, expect, it } from "vitest";
import {
  applyProfileEdits,
  mergeExtractedProfilePreservingUserEdits,
} from "./profile-edit";
import type { ParsedCareerProfile } from "./career-profile";

function baseProfile(): ParsedCareerProfile {
  const empty = { value: [] as never[], confidence: 0, source: null, directlyFound: false, needsReview: false };
  const emptyStr = { value: null, confidence: 0, source: null, directlyFound: false, needsReview: false };
  return {
    fullName: emptyStr,
    email: emptyStr,
    phone: emptyStr,
    currentLocation: emptyStr,
    professionalSummary: emptyStr,
    currentRole: emptyStr,
    jobTitles: { ...empty, value: [] },
    experienceYears: { value: null, confidence: 0, source: null, directlyFound: false, needsReview: false },
    skills: { ...empty, value: [] },
    experience: { ...empty, value: [] },
    education: { ...empty, value: [] },
    projects: { ...empty, value: [] },
    certifications: { ...empty, value: [] },
    languages: { ...empty, value: [] },
    linkedinUrl: emptyStr,
    githubUrl: emptyStr,
    portfolioUrl: emptyStr,
    meta: { extractionMethod: "deterministic", generatedAt: new Date().toISOString() },
  };
}

describe("applyProfileEdits", () => {
  it("only touches sections present in the edit payload", () => {
    const profile = baseProfile();
    profile.certifications = { value: ["AWS"], confidence: 0.6, source: "resume", directlyFound: true, needsReview: true };

    const edited = applyProfileEdits(profile, { languages: ["English", "Hindi"] });

    expect(edited.languages.value).toEqual(["English", "Hindi"]);
    expect(edited.languages.directlyFound).toBe(true);
    expect(edited.languages.needsReview).toBe(false);
    // Untouched section preserved byte-for-byte.
    expect(edited.certifications).toEqual(profile.certifications);
  });

  it("marks an edited experience list as user-confirmed and no longer needing review", () => {
    const profile = baseProfile();
    profile.experience = {
      value: [],
      confidence: 0.4,
      source: "resume",
      directlyFound: true,
      needsReview: true,
    };

    const edited = applyProfileEdits(profile, {
      experience: [
        {
          title: "Software Engineer",
          company: "Acme",
          location: "Pune",
          startDate: "2022",
          endDate: null,
          current: true,
          description: "Built things",
          evidence: "user-entered",
        },
      ],
    });

    expect(edited.experience.value).toHaveLength(1);
    expect(edited.experience.confidence).toBe(1);
    expect(edited.experience.needsReview).toBe(false);
    expect(edited.experience.source).toBe("user_edit");
  });

  it("does not mutate the original profile object", () => {
    const profile = baseProfile();
    const edited = applyProfileEdits(profile, { professionalSummary: "Senior engineer" });
    expect(profile.professionalSummary.value).toBeNull();
    expect(edited.professionalSummary.value).toBe("Senior engineer");
  });

  it("allows clearing a list back to empty (explicit removal of all entries)", () => {
    const profile = baseProfile();
    profile.projects = {
      value: [{ name: "Old project", description: null, technologies: [], evidence: "x" }],
      confidence: 0.5,
      source: "resume",
      directlyFound: true,
      needsReview: false,
    };
    const edited = applyProfileEdits(profile, { projects: [] });
    expect(edited.projects.value).toEqual([]);
    expect(edited.projects.directlyFound).toBe(true);
  });

  it("marks identity, career targets, skills, and links as explicit user edits", () => {
    const edited = applyProfileEdits(baseProfile(), {
      fullName: "Aarav Sharma",
      currentRole: "Implementation Analyst",
      jobTitles: ["Implementation Analyst", "Operations Analyst"],
      skills: ["SQL", "Jira"],
      linkedinUrl: "https://www.linkedin.com/in/aarav",
    });

    expect(edited.fullName).toMatchObject({
      value: "Aarav Sharma",
      confidence: 1,
      source: "user_edit",
      needsReview: false,
    });
    expect(edited.jobTitles.value).toEqual([
      "Implementation Analyst",
      "Operations Analyst",
    ]);
    expect(edited.skills.value).toEqual(["SQL", "Jira"]);
    expect(edited.linkedinUrl.value).toBe("https://www.linkedin.com/in/aarav");
  });

  it("preserves user edits while accepting fresh values for unconfirmed fields", () => {
    const current = applyProfileEdits(baseProfile(), {
      fullName: "Aarav Sharma",
      skills: ["SQL", "Jira"],
    });
    current.email = {
      value: "old@example.com",
      confidence: 0.7,
      source: "header",
      directlyFound: true,
      needsReview: true,
    };
    const reprocessed = baseProfile();
    reprocessed.fullName = {
      value: "Incorrect Extracted Name",
      confidence: 0.8,
      source: "header",
      directlyFound: true,
      needsReview: false,
    };
    reprocessed.skills = {
      value: ["Python"],
      confidence: 0.9,
      source: "skills",
      directlyFound: true,
      needsReview: false,
    };
    reprocessed.email = {
      value: "new@example.com",
      confidence: 0.95,
      source: "header",
      directlyFound: true,
      needsReview: false,
    };

    const merged = mergeExtractedProfilePreservingUserEdits(current, reprocessed);
    expect(merged.fullName.value).toBe("Aarav Sharma");
    expect(merged.skills.value).toEqual(["SQL", "Jira"]);
    expect(merged.email.value).toBe("new@example.com");
  });
});
