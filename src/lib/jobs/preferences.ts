import type { UserSettings, WorkMode, EmploymentType } from "@prisma/client";
import type { DiscoveredJob } from "./types";

export type SearchProgressStage =
  | "validating_preferences"
  | "discovering_sources"
  | "fetching_jobs"
  | "filtering"
  | "deduplicating"
  | "scoring"
  | "saving"
  | "completed"
  | "failed";

export const SEARCH_STAGE_LABELS: Record<SearchProgressStage, string> = {
  validating_preferences: "Validating preferences",
  discovering_sources: "Discovering sources",
  fetching_jobs: "Fetching jobs",
  filtering: "Filtering by preferences",
  deduplicating: "Deduplicating",
  scoring: "Scoring matches",
  saving: "Saving results",
  completed: "Complete",
  failed: "Failed",
};

export const SEARCH_STAGE_ORDER: SearchProgressStage[] = [
  "validating_preferences",
  "discovering_sources",
  "fetching_jobs",
  "filtering",
  "deduplicating",
  "scoring",
  "saving",
  "completed",
];

export function stageToPercent(stage: SearchProgressStage): number {
  const idx = SEARCH_STAGE_ORDER.indexOf(stage);
  if (idx < 0) return 5;
  if (stage === "completed") return 100;
  return Math.round((idx / (SEARCH_STAGE_ORDER.length - 1)) * 100);
}

export interface PreferenceValidation {
  complete: boolean;
  missing: string[];
}

export function validateSearchPreferences(
  settings: UserSettings | null
): PreferenceValidation {
  if (!settings) {
    return { complete: false, missing: ["job titles", "locations or remote", "skills"] };
  }

  const missing: string[] = [];
  if (!settings.jobTitles?.length) missing.push("job titles");
  if (!settings.requiredSkills?.length) missing.push("primary skills");
  if (
    !settings.locations?.length &&
    !settings.workModes?.includes("REMOTE")
  ) {
    missing.push("locations or remote preference");
  }
  if (settings.experienceYears == null) missing.push("years of experience");

  return { complete: missing.length === 0 && settings.preferencesComplete, missing };
}

export function hasMinimumPreferences(settings: UserSettings | null): boolean {
  const { missing } = validateSearchPreferences(settings);
  return missing.length === 0;
}

export interface JobFilterResult {
  accepted: boolean;
  score: number;
  reasons: string[];
  exclusions: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function titleMatches(jobTitle: string, preferredTitles: string[]): boolean {
  const t = normalize(jobTitle);
  return preferredTitles.some((pref) => {
    const p = normalize(pref);
    return t.includes(p) || p.includes(t);
  });
}

function detectWorkMode(job: DiscoveredJob): WorkMode {
  const loc = normalize(job.location || "");
  const desc = normalize(job.description || "");
  if (loc.includes("remote") || desc.includes("remote")) return "REMOTE";
  if (loc.includes("hybrid") || desc.includes("hybrid")) return "HYBRID";
  if (loc) return "ONSITE";
  return "UNKNOWN";
}

function locationMatches(
  job: DiscoveredJob,
  settings: UserSettings,
  workMode: WorkMode
): { ok: boolean; reason?: string } {
  if (workMode === "REMOTE" && settings.workModes.includes("REMOTE")) {
    return { ok: true, reason: "Remote role matches remote preference" };
  }

  const prefs = settings.locations.map(normalize).filter(Boolean);
  if (prefs.length === 0) return { ok: true };

  const loc = normalize(job.location || "");
  if (!loc) {
    if (settings.willingToRelocate) return { ok: true, reason: "Relocation enabled" };
    return { ok: false, reason: "Location unknown and relocation disabled" };
  }

  const matched = prefs.some(
    (p) => loc.includes(p) || p.includes(loc) || (p === "remote" && workMode === "REMOTE")
  );
  if (matched) return { ok: true, reason: `Location matches ${job.location}` };

  if (settings.willingToRelocate) {
    return { ok: true, reason: "Outside preferred locations but relocation enabled" };
  }

  return {
    ok: false,
    reason: `Location "${job.location}" not in preferred locations`,
  };
}

export function evaluateJobAgainstPreferences(
  job: DiscoveredJob,
  settings: UserSettings
): JobFilterResult {
  const reasons: string[] = [];
  const exclusions: string[] = [];
  let score = 50;

  const companyNorm = normalize(job.company);
  if (
    settings.excludedCompanies?.some((c) => companyNorm.includes(normalize(c)))
  ) {
    exclusions.push(`Company "${job.company}" is excluded`);
    return { accepted: false, score: 0, reasons, exclusions };
  }

  if (settings.targetCompanies?.length) {
    const included = settings.targetCompanies.some((c) =>
      companyNorm.includes(normalize(c))
    );
    if (included) {
      score += 15;
      reasons.push(`Target company: ${job.company}`);
    }
  }

  if (!titleMatches(job.title, settings.jobTitles)) {
    exclusions.push(`Title "${job.title}" does not match desired roles`);
    return { accepted: false, score: 0, reasons, exclusions };
  }
  reasons.push(`Title matches desired role`);

  const workMode = detectWorkMode(job);
  if (settings.workModes?.length && !settings.workModes.includes(workMode)) {
    if (workMode !== "UNKNOWN") {
      exclusions.push(`Work mode ${workMode} not in your preferences`);
      return { accepted: false, score: 0, reasons, exclusions };
    }
  }
  if (workMode !== "UNKNOWN") reasons.push(`Work mode: ${workMode}`);

  const locCheck = locationMatches(job, settings, workMode);
  if (!locCheck.ok) {
    exclusions.push(locCheck.reason || "Location mismatch");
    return { accepted: false, score: 0, reasons, exclusions };
  }
  if (locCheck.reason) reasons.push(locCheck.reason);

  if (settings.salaryMin && job.salaryMax && job.salaryMax < settings.salaryMin) {
    exclusions.push(`Salary below minimum (${settings.salaryMin})`);
    return { accepted: false, score: 0, reasons, exclusions };
  }
  if (settings.salaryMax && job.salaryMin && job.salaryMin > settings.salaryMax) {
    exclusions.push(`Salary above maximum (${settings.salaryMax})`);
    return { accepted: false, score: 0, reasons, exclusions };
  }

  const jobText = normalize(`${job.title} ${job.description}`);
  const matchedSkills = settings.requiredSkills.filter((s) =>
    jobText.includes(normalize(s))
  );
  if (matchedSkills.length === 0 && settings.requiredSkills.length > 0) {
    exclusions.push("Missing required skills");
    return { accepted: false, score: 0, reasons, exclusions };
  }
  score += Math.min(25, matchedSkills.length * 8);
  if (matchedSkills.length) reasons.push(`Skills: ${matchedSkills.join(", ")}`);

  const preferredHits = (settings.preferredSkills || []).filter((s) =>
    jobText.includes(normalize(s))
  );
  score += Math.min(15, preferredHits.length * 5);
  if (preferredHits.length) reasons.push(`Preferred skills: ${preferredHits.join(", ")}`);

  if (settings.experienceYears != null) {
    const exp = settings.experienceYears;
    if (exp >= 5) score += 5;
    reasons.push(`Experience level ~${exp} years`);
  }

  score = Math.min(100, Math.max(0, score));
  const accepted = score >= (settings.matchThreshold || 50);

  if (!accepted) {
    exclusions.push(`Match score ${score} below threshold ${settings.matchThreshold}`);
  } else {
    reasons.push(`Match score ${score} meets threshold`);
  }

  return { accepted, score, reasons, exclusions };
}

export function buildDiscoveryBoards(settings: UserSettings): {
  greenhouse: string[];
  lever: string[];
  ashby: string[];
  workday: string[];
} {
  const envBoards = (key: string) =>
    (process.env[key] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const userBoards = settings.targetCompanies || [];

  return {
    greenhouse: [...new Set([...userBoards, ...envBoards("JOB_SEARCH_GREENHOUSE_BOARDS")])],
    lever: [...new Set([...userBoards, ...envBoards("JOB_SEARCH_LEVER_COMPANIES")])],
    ashby: [...new Set([...userBoards, ...envBoards("JOB_SEARCH_ASHBY_BOARDS")])],
    workday: [...new Set([...userBoards, ...envBoards("JOB_SEARCH_WORKDAY_COMPANIES")])],
  };
}

export type PreferencePayload = {
  jobTitles: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  locations: string[];
  workModes: WorkMode[];
  salaryMin: number | null;
  salaryMax: number | null;
  employmentTypes: EmploymentType[];
  visaSponsorshipRequired: boolean;
  willingToRelocate: boolean;
  industries: string[];
  targetCompanies: string[];
  excludedCompanies: string[];
  noticePeriodDays: number | null;
  matchThreshold: number;
  preferencesComplete: boolean;
};

export function settingsToPayload(settings: UserSettings): PreferencePayload {
  return {
    jobTitles: settings.jobTitles,
    requiredSkills: settings.requiredSkills,
    preferredSkills: settings.preferredSkills,
    experienceYears: settings.experienceYears,
    locations: settings.locations,
    workModes: settings.workModes,
    salaryMin: settings.salaryMin,
    salaryMax: settings.salaryMax,
    employmentTypes: settings.employmentTypes,
    visaSponsorshipRequired: settings.visaSponsorshipRequired,
    willingToRelocate: settings.willingToRelocate,
    industries: settings.industries,
    targetCompanies: settings.targetCompanies,
    excludedCompanies: settings.excludedCompanies,
    noticePeriodDays: settings.noticePeriodDays,
    matchThreshold: settings.matchThreshold,
    preferencesComplete: settings.preferencesComplete,
  };
}
