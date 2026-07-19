import { describe, expect, it } from "vitest";
import type { UserSettings } from "@prisma/client";
import {
  INDIA_COMPANY_BOARD_REGISTRY,
  selectCompanyBoards,
} from "./company-board-registry";

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: "settings-1",
    userId: "user-1",
    jobTitles: ["Software Engineer"],
    experienceYears: 1,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "INR",
    workModes: ["REMOTE"],
    locations: ["India"],
    visaSponsorshipRequired: false,
    requiredSkills: ["TypeScript"],
    preferredSkills: [],
    companySizes: [],
    employmentTypes: ["FULL_TIME"],
    matchThreshold: 60,
    autoSubmitEnabled: false,
    autoSubmitSources: [],
    requireReview: true,
    enabledSources: ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"],
    searchFrequencyHours: 24,
    notificationsEnabled: true,
    sheetsSyncEnabled: false,
    sheetsId: null,
    calendarSyncEnabled: false,
    gmailSyncEnabled: false,
    driveFolderId: null,
    targetCompanies: [],
    excludedCompanies: [],
    industries: ["Software"],
    willingToRelocate: false,
    noticePeriodDays: null,
    currentRole: null,
    currentSalary: null,
    workAuthorization: null,
    travelWillingness: null,
    sectorPreference: "PRIVATE",
    governmentCategories: [],
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

describe("India company board registry", () => {
  it("contains verified public boards across all supported ATS platforms", () => {
    expect(
      new Set(INDIA_COMPANY_BOARD_REGISTRY.map((item) => item.platform))
    ).toEqual(new Set(["greenhouse", "lever", "ashby", "workday"]));
    expect(
      INDIA_COMPANY_BOARD_REGISTRY.every(
        (item) =>
          item.indiaHiring && item.verificationMethod === "public_api"
      )
    ).toBe(true);
  });

  it("seeds boards when the user did not know employer-specific board slugs", () => {
    const boards = selectCompanyBoards(settings());
    expect(boards.greenhouse.length).toBe(4);
    expect(boards.lever.length).toBe(4);
    expect(boards.ashby.length).toBe(4);
    expect(boards.workday.length).toBe(4);
  });

  it("prioritizes a requested known employer without using its display name for every ATS", () => {
    const boards = selectCompanyBoards(
      settings({ targetCompanies: ["Coursera"] })
    );
    expect(boards.greenhouse[0]).toBe("coursera");
    expect(boards.lever).not.toContain("Coursera");
  });
});
