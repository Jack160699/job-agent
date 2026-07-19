import type {
  EmploymentType,
  JobSource,
  UserSettings,
  WorkMode,
} from "@prisma/client";
import {
  expandRoleTitles,
  normalizeLocation,
  seniorityForExperience,
} from "./normalization";

export const SEARCH_PLAN_VERSION = "2026-07-india-v1";

export interface SearchPlanQuery {
  title: string;
  location: string | null;
  remoteScope: "INDIA" | "WORLDWIDE" | null;
  stage: "strict" | "balanced" | "recovery";
  reasons: string[];
}

export interface UserSearchPlan {
  version: string;
  userId: string;
  primaryRoles: string[];
  alternativeRoles: string[];
  verifiedSkills: string[];
  experienceYears: number | null;
  seniority: ReturnType<typeof seniorityForExperience>;
  locations: Array<{
    raw: string;
    normalized: string;
    group: string | null;
    country: "IN" | "OTHER" | "UNKNOWN";
  }>;
  workModes: WorkMode[];
  willingToRelocate: boolean;
  currentSalary: number | null;
  expectedSalary: { min: number | null; max: number | null };
  currency: string;
  noticePeriodDays: number | null;
  employmentTypes: EmploymentType[];
  industries: string[];
  targetCompanies: string[];
  excludedCompanies: string[];
  visaSponsorshipRequired: boolean;
  minimumMatchThreshold: number;
  enabledSources: JobSource[];
  queries: SearchPlanQuery[];
  generatedAt: string;
}

export type SearchPlanSettings = Pick<
  UserSettings,
  | "userId"
  | "jobTitles"
  | "requiredSkills"
  | "experienceYears"
  | "locations"
  | "workModes"
  | "willingToRelocate"
  | "currentSalary"
  | "salaryMin"
  | "salaryMax"
  | "salaryCurrency"
  | "noticePeriodDays"
  | "employmentTypes"
  | "industries"
  | "targetCompanies"
  | "excludedCompanies"
  | "visaSponsorshipRequired"
  | "matchThreshold"
  | "enabledSources"
>;

export function buildUserSearchPlan(
  settings: SearchPlanSettings,
  now = new Date()
): UserSearchPlan {
  const primaryRoles = settings.jobTitles
    .map((value) => value.trim())
    .filter(Boolean);
  const expanded = expandRoleTitles(primaryRoles);
  const primaryKey = new Set(primaryRoles.map((title) => title.toLowerCase()));
  const alternativeRoles = expanded.filter(
    (title) => !primaryKey.has(title.toLowerCase())
  );
  const locations = settings.locations
    .map((raw) => ({ raw, ...normalizeLocation(raw) }))
    .map(({ raw, normalized, group, country }) => ({
      raw,
      normalized,
      group,
      country,
    }));
  const indiaFirst = locations.some((location) => location.country === "IN");
  const remotePreferred = settings.workModes.includes("REMOTE");

  const queryLocations =
    locations.length > 0
      ? locations.map((location) => location.raw)
      : remotePreferred
        ? [indiaFirst ? "India remote" : "Remote"]
        : [null];

  const queryTitles = [
    ...primaryRoles.map((title) => ({ title, stage: "strict" as const })),
    ...alternativeRoles.slice(0, 6).map((title) => ({
      title,
      stage: "balanced" as const,
    })),
    ...alternativeRoles.slice(6, 12).map((title) => ({
      title,
      stage: "recovery" as const,
    })),
  ].slice(0, 12);
  const queries: SearchPlanQuery[] = [];
  for (const { title, stage } of queryTitles) {
    for (const location of queryLocations) {
      const normalizedLocation = location
        ? normalizeLocation(location)
        : null;
      queries.push({
        title,
        location,
        stage,
        remoteScope:
          remotePreferred && indiaFirst
            ? "INDIA"
            : remotePreferred
              ? "WORLDWIDE"
              : null,
        reasons: [
          primaryKey.has(title.toLowerCase())
            ? `Primary target role: ${title}`
            : `Adjacent title for a target role: ${title}`,
          `Search stage: ${stage}`,
          location
            ? `Preferred location: ${location}`
            : "No location constraint was supplied",
          ...(normalizedLocation?.group
            ? [`Normalized location group: ${normalizedLocation.group}`]
            : []),
          ...(remotePreferred
            ? [
                indiaFirst
                  ? "Remote results must confirm India eligibility"
                  : "Remote work is selected",
              ]
            : []),
        ],
      });
    }
  }

  return {
    version: SEARCH_PLAN_VERSION,
    userId: settings.userId,
    primaryRoles,
    alternativeRoles,
    verifiedSkills: [...settings.requiredSkills],
    experienceYears: settings.experienceYears,
    seniority: seniorityForExperience(settings.experienceYears),
    locations,
    workModes: [...settings.workModes],
    willingToRelocate: settings.willingToRelocate,
    currentSalary: settings.currentSalary,
    expectedSalary: {
      min: settings.salaryMin,
      max: settings.salaryMax,
    },
    currency: settings.salaryCurrency,
    noticePeriodDays: settings.noticePeriodDays,
    employmentTypes: [...settings.employmentTypes],
    industries: [...settings.industries],
    targetCompanies: [...settings.targetCompanies],
    excludedCompanies: [...settings.excludedCompanies],
    visaSponsorshipRequired: settings.visaSponsorshipRequired,
    minimumMatchThreshold: settings.matchThreshold,
    enabledSources: [...settings.enabledSources],
    queries,
    generatedAt: now.toISOString(),
  };
}
