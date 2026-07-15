import { describe, expect, it } from "vitest";
import type { UserSettings } from "@prisma/client";
import { buildUserSearchPlan } from "./search-plan";

function settings(
  userId: string,
  overrides: Partial<UserSettings>
): UserSettings {
  return {
    id: `settings-${userId}`,
    userId,
    jobTitles: ["Software Engineer"],
    experienceYears: 2,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "INR",
    workModes: ["ONSITE"],
    locations: ["Pune"],
    visaSponsorshipRequired: false,
    requiredSkills: ["JavaScript"],
    preferredSkills: [],
    companySizes: [],
    employmentTypes: ["FULL_TIME"],
    matchThreshold: 70,
    autoSubmitEnabled: false,
    autoSubmitSources: [],
    requireReview: true,
    enabledSources: ["GREENHOUSE"],
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
    quietHoursStart: null,
    quietHoursEnd: null,
    proactiveFrequencyHours: 24,
    disabledRecommendationCategories: [],
    dailyDigestEnabled: false,
    weeklyReportEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const SYNTHETIC_PROFILES: UserSettings[] = [
  settings("mca-fresher-pune", {
    jobTitles: ["Junior Software Developer"],
    experienceYears: 0,
    requiredSkills: ["Java", "SQL"],
    locations: ["Pune"],
  }),
  settings("frontend-bengaluru", {
    jobTitles: ["Frontend Developer"],
    experienceYears: 2,
    requiredSkills: ["React", "TypeScript"],
    locations: ["Bengaluru"],
    workModes: ["HYBRID"],
  }),
  settings("operations-pune-remote", {
    jobTitles: ["Operations Analyst"],
    requiredSkills: ["Excel", "SQL"],
    locations: ["Pune"],
    workModes: ["REMOTE", "HYBRID"],
  }),
  settings("mechanical-pune", {
    jobTitles: ["Mechanical Engineer"],
    requiredSkills: ["AutoCAD", "Manufacturing"],
    industries: ["Manufacturing"],
    locations: ["Pune"],
  }),
  settings("hr-mumbai", {
    jobTitles: ["HR Executive"],
    requiredSkills: ["Recruitment"],
    locations: ["Mumbai"],
  }),
  settings("finance-delhi", {
    jobTitles: ["Finance Analyst"],
    requiredSkills: ["Financial modelling"],
    locations: ["Delhi NCR"],
  }),
  settings("tier2-remote", {
    jobTitles: ["Software Developer"],
    locations: ["Indore", "India"],
    workModes: ["REMOTE"],
  }),
  settings("backend-hybrid", {
    jobTitles: ["Backend Engineer"],
    experienceYears: 7,
    requiredSkills: ["Node.js", "PostgreSQL"],
    locations: ["Hyderabad"],
    workModes: ["HYBRID"],
  }),
  settings("strict-salary", {
    jobTitles: ["Software Engineer"],
    salaryMin: 1800000,
    salaryMax: 2400000,
    salaryCurrency: "INR",
  }),
  settings("excluded-companies", {
    jobTitles: ["Software Engineer"],
    targetCompanies: ["Acme"],
    excludedCompanies: ["Bad Corp"],
  }),
];

describe("per-user search plan generation", () => {
  it("creates explainable queries from each user's real preferences", () => {
    for (const profile of SYNTHETIC_PROFILES) {
      const plan = buildUserSearchPlan(profile, new Date("2026-07-15T00:00:00Z"));
      expect(plan.userId).toBe(profile.userId);
      expect(plan.queries.length).toBeGreaterThan(0);
      expect(plan.queries.every((query) => query.reasons.length >= 2)).toBe(true);
      expect(plan.verifiedSkills).toEqual(profile.requiredSkills);
    }
  });

  it("produces meaningfully different plans for all ten profiles", () => {
    const signatures = SYNTHETIC_PROFILES.map((profile) => {
      const plan = buildUserSearchPlan(profile);
      return JSON.stringify({
        roles: plan.primaryRoles,
        locations: plan.locations,
        modes: plan.workModes,
        salary: plan.expectedSalary,
        industries: plan.industries,
        excluded: plan.excludedCompanies,
      });
    });
    expect(new Set(signatures).size).toBe(SYNTHETIC_PROFILES.length);
  });

  it("does not inject San Francisco or US locations into Indian plans", () => {
    for (const profile of SYNTHETIC_PROFILES) {
      const serialized = JSON.stringify(buildUserSearchPlan(profile)).toLowerCase();
      expect(serialized).not.toContain("san francisco");
      expect(serialized).not.toContain("united states");
    }
  });

  it("keeps one user's preferences isolated from another user", () => {
    const pune = buildUserSearchPlan(SYNTHETIC_PROFILES[0]);
    const bengaluru = buildUserSearchPlan(SYNTHETIC_PROFILES[1]);
    expect(pune.locations[0].group).toBe("pune");
    expect(bengaluru.locations[0].group).toBe("bengaluru");
    expect(pune.primaryRoles).not.toEqual(bengaluru.primaryRoles);
  });
});
