import { describe, expect, it } from "vitest";
import { calculateProfileReadiness, evaluateJobAgainstPreferences } from "@/lib/jobs/preferences";
import type { UserSettings } from "@prisma/client";
import type { DiscoveredJob } from "@/lib/jobs/types";

function baseSettings(overrides: Partial<UserSettings>): UserSettings {
  return {
    id: "s1",
    userId: "u1",
    jobTitles: ["Frontend Developer"],
    experienceYears: 3,
    salaryMin: 800000,
    salaryMax: 1500000,
    salaryCurrency: "INR",
    workModes: ["REMOTE", "HYBRID"],
    locations: ["Pune", "Remote"],
    visaSponsorshipRequired: false,
    requiredSkills: ["React", "TypeScript"],
    preferredSkills: ["Next.js"],
    companySizes: [],
    employmentTypes: [],
    matchThreshold: 70,
    autoSubmitEnabled: false,
    autoSubmitSources: [],
    requireReview: true,
    enabledSources: [],
    searchFrequencyHours: 6,
    notificationsEnabled: true,
    sheetsSyncEnabled: false,
    sheetsId: null,
    calendarSyncEnabled: false,
    gmailSyncEnabled: false,
    driveFolderId: null,
    targetCompanies: [],
    excludedCompanies: [],
    industries: [],
    willingToRelocate: false,
    noticePeriodDays: null,
    currentRole: null,
    currentSalary: null,
    preferencesComplete: true,
    driveBackupEnabled: false,
    onboardingCompletedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserSettings;
}

function sampleJob(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    externalId: "1",
    source: "GREENHOUSE",
    sourceUrl: "https://example.com/job/1",
    title: "Frontend Developer",
    company: "Acme",
    location: "Pune, India",
    description: "React TypeScript frontend role in Pune. Remote friendly hybrid.",
    postedAt: new Date(),
    ...overrides,
  };
}

describe("preference-aware discovery", () => {
  it("accepts Pune frontend role for Pune profile", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({ title: "Frontend Developer" }),
      baseSettings({ locations: ["Pune"], workModes: ["HYBRID", "REMOTE"], matchThreshold: 50 })
    );
    expect(result.accepted).toBe(true);
    expect(result.classification).not.toBe("REJECTED");
  });

  it("rejects San Francisco onsite role for Pune profile", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Frontend Developer",
        location: "San Francisco, CA",
        description: "Onsite only. React TypeScript required.",
      }),
      baseSettings({ locations: ["Pune"], workModes: ["REMOTE"], willingToRelocate: false })
    );
    expect(result.accepted).toBe(false);
    expect(result.classification).toBe("REJECTED");
  });

  it("accepts remote India role for remote India profile", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Full Stack Developer",
        location: "Remote - India",
        description: "Remote full stack role. React Node TypeScript.",
      }),
      baseSettings({
        jobTitles: ["Full Stack Developer"],
        locations: ["Remote", "India"],
        workModes: ["REMOTE"],
        requiredSkills: ["React", "Node"],
        matchThreshold: 50,
      })
    );
    expect(result.accepted).toBe(true);
  });

  it("profiles produce materially different acceptance", () => {
    const sfJob = sampleJob({
      title: "Frontend Developer",
      location: "San Francisco, CA",
      description: "Onsite React TypeScript role in SF.",
    });
    const remoteJob = sampleJob({
      title: "Full Stack Developer",
      location: "Remote - India",
      description: "Remote React Node TypeScript role.",
    });

    const puneOnSf = evaluateJobAgainstPreferences(
      sfJob,
      baseSettings({ locations: ["Pune"], workModes: ["REMOTE"], willingToRelocate: false })
    );
    const remoteOnRemote = evaluateJobAgainstPreferences(
      remoteJob,
      baseSettings({
        jobTitles: ["Full Stack Developer"],
        locations: ["Remote"],
        workModes: ["REMOTE"],
        requiredSkills: ["React", "Node"],
        matchThreshold: 50,
      })
    );

    expect(puneOnSf.accepted).toBe(false);
    expect(remoteOnRemote.accepted).toBe(true);
  });

  it("ranks fresh postings above otherwise identical stale postings", () => {
    const settings = baseSettings({ matchThreshold: 50 });
    const fresh = evaluateJobAgainstPreferences(
      sampleJob({ postedAt: new Date() }),
      settings
    );
    const stale = evaluateJobAgainstPreferences(
      sampleJob({
        postedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      }),
      settings
    );

    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(fresh.breakdown.freshnessScore).toBe(100);
    expect(stale.exclusions.some((reason) => reason.includes("120 days"))).toBe(
      true
    );
  });

  it("surfaces uncertainty when a posting date is unavailable", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({ postedAt: undefined }),
      baseSettings({ matchThreshold: 50 })
    );

    expect(result.uncertain).toContain("Posting date is unavailable");
    expect(result.breakdown.freshnessScore).toBe(50);
  });

  it("does not create a false zero when a matching source has a shortened description", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        description:
          "Frontend role. See the official posting for full requirements.",
      }),
      baseSettings({
        matchThreshold: 50,
        workModes: ["ONSITE", "HYBRID", "REMOTE"],
      })
    );

    expect(result.accepted).toBe(true);
    expect(result.breakdown.skillMatch).toBe(0);
    expect(result.concerns.join(" ")).toMatch(/skill was verified/i);
    expect(result.uncertain.join(" ")).toMatch(/shortened description/i);
  });

  it("rejects senior roles for a fresher with an explanation", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Senior Frontend Developer",
        description: "Senior React TypeScript frontend role.",
      }),
      baseSettings({ experienceYears: 0, matchThreshold: 50 })
    );
    expect(result.classification).toBe("REJECTED");
    expect(result.exclusions.join(" ")).toMatch(/seniority|exceeds/i);
  });

  it("does not misclassify Staff Nurse as an engineering lead role", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Staff Nurse",
        company: "City Hospital",
        location: "Pune, India",
        description:
          "Staff Nurse for ward patient care. GNM or BSc Nursing registration required.",
      }),
      baseSettings({
        jobTitles: ["Registered Nurse"],
        experienceYears: 0,
        requiredSkills: ["Patient care"],
        preferredSkills: ["GNM"],
        locations: ["Pune"],
        workModes: ["ONSITE"],
        salaryMin: null,
        salaryMax: null,
        matchThreshold: 50,
      })
    );

    expect(result.accepted).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/healthcare qualifications/i);
    expect(result.exclusions.join(" ")).not.toMatch(/seniority/i);
  });

  it("keeps explicitly fresher-friendly roles reviewable despite a stated experience minimum", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Graduate Engineer Trainee",
        description:
          "Entry level graduate engineer trainee. React TypeScript. One year preferred.",
        experienceMin: 1,
      }),
      baseSettings({
        jobTitles: ["Software Developer"],
        experienceYears: 0,
        workModes: ["ONSITE", "HYBRID", "REMOTE"],
        salaryMin: null,
        salaryMax: null,
        matchThreshold: 50,
      })
    );

    expect(result.accepted).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/fresher-friendly/i);
    expect(result.concerns.join(" ")).toMatch(/1\+ years/i);
  });

  it("does not compare salaries with different currencies", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        salaryMin: 100_000,
        salaryMax: 120_000,
        salaryCurrency: "USD",
      }),
      baseSettings({
        salaryMin: 800_000,
        salaryMax: 1_500_000,
        salaryCurrency: "INR",
        matchThreshold: 50,
      })
    );
    expect(result.uncertain.join(" ")).toContain("cannot be compared");
  });

  it("keeps unconfirmed-India-eligibility remote roles visible as uncertain rather than rejecting them", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Full Stack Developer",
        location: "Remote",
        description: "Remote full stack role. React Node TypeScript. No location restriction stated.",
      }),
      baseSettings({
        jobTitles: ["Full Stack Developer"],
        locations: ["Pune", "India"],
        workModes: ["REMOTE"],
        requiredSkills: ["React", "Node"],
        matchThreshold: 50,
      })
    );
    expect(result.classification).not.toBe("REJECTED");
    expect(result.uncertain.some((u) => /india/i.test(u))).toBe(true);
  });

  it("still rejects remote roles explicitly restricted to a non-India location", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({
        title: "Full Stack Developer",
        location: "Remote - US Only",
        description: "Remote full stack role. React Node TypeScript.",
      }),
      baseSettings({
        jobTitles: ["Full Stack Developer"],
        locations: ["Pune", "India"],
        workModes: ["REMOTE"],
        requiredSkills: ["React", "Node"],
        matchThreshold: 50,
      })
    );
    expect(result.classification).toBe("REJECTED");
  });

  it("rejects expired closing dates", () => {
    const result = evaluateJobAgainstPreferences(
      sampleJob({ closesAt: new Date("2020-01-01T00:00:00Z") }),
      baseSettings({ matchThreshold: 50 })
    );
    expect(result.classification).toBe("REJECTED");
    expect(result.exclusions).toContain("Application closing date has passed");
  });
});

describe("Phase B: profile readiness (Profile ready: NN%)", () => {
  it("returns 0% across all categories for a null profile", () => {
    const readiness = calculateProfileReadiness(null);
    expect(readiness.percent).toBe(0);
    expect(readiness.requiredForSearch.percent).toBe(0);
    expect(readiness.requiredForApplication.percent).toBe(0);
    expect(readiness.requiredForSearch.missing).toContain("Target job titles");
  });

  it("only lists fields that are actually absent as missing", () => {
    const readiness = calculateProfileReadiness(
      baseSettings({
        jobTitles: ["Frontend Developer"],
        requiredSkills: ["React"],
        locations: ["Pune"],
        workModes: ["HYBRID"],
        experienceYears: 3,
      })
    );
    expect(readiness.requiredForSearch.missing).toEqual([]);
    expect(readiness.requiredForSearch.percent).toBe(100);
  });

  it("weights required-for-search above optional fields", () => {
    const searchOnly = calculateProfileReadiness(
      baseSettings({
        jobTitles: ["Frontend Developer"],
        requiredSkills: ["React"],
        locations: ["Pune"],
        workModes: ["HYBRID"],
        experienceYears: 3,
        noticePeriodDays: null,
        salaryMin: null,
        salaryMax: null,
        currentSalary: null,
        employmentTypes: [],
        industries: [],
        targetCompanies: [],
        companySizes: [],
      })
    );
    const optionalOnly = calculateProfileReadiness(
      baseSettings({
        jobTitles: [],
        requiredSkills: [],
        locations: [],
        workModes: [],
        experienceYears: null,
        industries: ["Fintech"],
        targetCompanies: ["Acme"],
        companySizes: ["51-200"],
      })
    );
    expect(searchOnly.percent).toBeGreaterThan(optionalOnly.percent);
  });
});
