import { describe, expect, it } from "vitest";
import {
  detectWorkMode,
  evaluateJobAgainstPreferences,
} from "@/lib/jobs/preferences";
import type { UserSettings } from "@prisma/client";
import type { DiscoveredJob } from "@/lib/jobs/types";
import {
  orderedPublicDiscoverySources,
} from "@/lib/jobs/public-discovery";
import { extractLocationHint, titlesAreRelated } from "@/lib/jobs/normalization";

function baseSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: "s1",
    userId: "u1",
    jobTitles: ["Software Developer", "Associate Software Engineer"],
    experienceYears: 0,
    salaryMin: 400000,
    salaryMax: null,
    salaryCurrency: "INR",
    workModes: ["REMOTE"],
    locations: ["Pune", "Bengaluru", "India"],
    visaSponsorshipRequired: false,
    requiredSkills: ["TypeScript", "React", "Node.js", "SQL"],
    preferredSkills: [],
    companySizes: [],
    employmentTypes: ["FULL_TIME"],
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
    willingToRelocate: true,
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

function publicJob(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    externalId: "p1",
    source: "LINKEDIN",
    sourceUrl: "https://in.linkedin.com/jobs/view/junior-software-developer-1",
    title: "Junior Software Developer",
    company: "Acme",
    location: "Pune",
    description: "Build product features with a graduate-friendly team.",
    metadata: {
      provenance: "public_discovery",
      discoveryMethod: "public_index",
      verificationState: "indexed_public_metadata",
    },
    ...overrides,
  };
}

describe("public discovery three-state relevance", () => {
  it("does not treat unknown salary as salary mismatch", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({ salaryMin: undefined, salaryMax: undefined }),
      baseSettings({ salaryMin: 500000 })
    );
    expect(result.exclusions.join(" ")).not.toMatch(/salary/i);
    expect(result.uncertain.some((item) => /salary/i.test(item))).toBe(true);
  });

  it("does not treat unknown work mode as work-mode mismatch", () => {
    expect(detectWorkMode(publicJob({ location: "Pune", description: "City role" }))).toBe(
      "UNKNOWN"
    );
    const result = evaluateJobAgainstPreferences(
      publicJob({ location: "Pune", description: "City role for graduates." }),
      baseSettings({ workModes: ["REMOTE"] })
    );
    expect(result.exclusions.join(" ")).not.toMatch(/work mode/i);
    expect(result.accepted).toBe(true);
  });

  it("does not treat unknown experience as experience mismatch", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({ experienceMin: undefined }),
      baseSettings({ experienceYears: 0 })
    );
    expect(result.exclusions.join(" ")).not.toMatch(/years; profile has/i);
    expect(result.uncertain.some((item) => /experience/i.test(item))).toBe(true);
  });

  it("does not reject public listings when snippet omits resume skills", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({
        location: undefined,
        description: "Junior software developer opening in India.",
      }),
      baseSettings({
        matchThreshold: 90,
        requiredSkills: ["TypeScript", "Kubernetes", "GraphQL"],
      })
    );
    expect(result.accepted).toBe(true);
    expect(result.classification).toBe("POTENTIAL_MATCH_REQUIRES_VERIFICATION");
    expect(result.requiresVerification).toBe(true);
  });

  it("rejects clear seniority conflicts for freshers", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({
        title: "Senior Software Engineer",
        description: "Lead architecture for 8+ years.",
      }),
      baseSettings({ experienceYears: 0 })
    );
    expect(result.accepted).toBe(false);
    expect(result.rejectionCode).toBe("seniority_mismatch");
  });

  it("rejects clear profession conflicts", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({
        title: "Staff Nurse",
        description: "GNM ward patient care hospital.",
      }),
      baseSettings()
    );
    expect(result.accepted).toBe(false);
    expect(result.rejectionCode).toBe("title_mismatch");
  });

  it("marks incomplete public results as potential matches with verification warning", () => {
    const result = evaluateJobAgainstPreferences(
      publicJob({
        location: undefined,
        description: "Open software role for graduates.",
      }),
      baseSettings({
        matchThreshold: 90,
        requiredSkills: ["TypeScript", "Kubernetes"],
      })
    );
    expect(result.classification).toBe("POTENTIAL_MATCH_REQUIRES_VERIFICATION");
    expect(result.recommendation).toMatch(/open source to verify/i);
    expect(result.matchedSignals).toContain("title_family");
  });

  it("recognizes MCA fresher, nursing, operations, banking, education, technician families", () => {
    expect(
      titlesAreRelated("Associate Software Engineer", "Junior Software Developer")
    ).toBe(true);
    expect(titlesAreRelated("Staff Nurse", "Nursing Officer")).toBe(true);
    expect(
      titlesAreRelated("Operations Analyst", "Implementation Analyst")
    ).toBe(true);
    expect(titlesAreRelated("Banking Associate", "KYC Analyst")).toBe(true);
    expect(titlesAreRelated("Teacher", "Assistant Professor")).toBe(true);
    expect(titlesAreRelated("Technician", "Junior Engineer")).toBe(true);
  });

  it("orders public sources by profession", () => {
    expect(orderedPublicDiscoverySources(["Staff Nurse"])[0]).toBe("INDEED");
    expect(orderedPublicDiscoverySources(["Operations Analyst"])[0]).toBe(
      "NAUKRI"
    );
    expect(orderedPublicDiscoverySources(["Software Developer"])[0]).toBe(
      "LINKEDIN"
    );
  });

  it("extracts location hints without fabricating preference cities", () => {
    expect(
      extractLocationHint("Staff Nurse jobs in Bengaluru hospital", ["Pune"])
    ).toBe("bengaluru");
    expect(extractLocationHint("Software role with competitive pay", ["Pune"])).toBeUndefined();
  });
});
