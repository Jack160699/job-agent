import { describe, expect, it } from "vitest";
import { evaluateJobAgainstPreferences } from "@/lib/jobs/preferences";
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
    expect(result.classification).not.toBe("REJECTED_BY_PREFERENCES");
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
    expect(result.classification).toBe("REJECTED_BY_PREFERENCES");
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
});
