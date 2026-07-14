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

export type MatchClassification =
  | "STRONG_MATCH"
  | "POSSIBLE_MATCH"
  | "LOW_MATCH"
  | "REJECTED_BY_PREFERENCES"
  | "MISSING_INFORMATION";

export interface MatchBreakdown {
  roleMatch: number;
  skillMatch: number;
  locationMatch: number;
  salaryMatch: number;
  experienceMatch: number;
  freshnessScore: number;
}

export interface JobFilterResult {
  accepted: boolean;
  score: number;
  classification: MatchClassification;
  reasons: string[];
  exclusions: string[];
  concerns: string[];
  breakdown: MatchBreakdown;
  recommendation: string;
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

function classifyScore(score: number, accepted: boolean): MatchClassification {
  if (!accepted) return "REJECTED_BY_PREFERENCES";
  if (score >= 80) return "STRONG_MATCH";
  if (score >= 65) return "POSSIBLE_MATCH";
  return "LOW_MATCH";
}

export function evaluateJobAgainstPreferences(
  job: DiscoveredJob,
  settings: UserSettings
): JobFilterResult {
  const reasons: string[] = [];
  const exclusions: string[] = [];
  const concerns: string[] = [];
  let score = 50;
  const breakdown: MatchBreakdown = {
    roleMatch: 0,
    skillMatch: 0,
    locationMatch: 0,
    salaryMatch: 50,
    experienceMatch: 50,
    freshnessScore: 50,
  };

  if (!job.location && !job.description) {
    return {
      accepted: false,
      score: 0,
      classification: "MISSING_INFORMATION",
      reasons: [],
      exclusions: ["Insufficient job information to evaluate"],
      concerns: [],
      breakdown,
      recommendation: "Skipped — missing location and description",
    };
  }

  const companyNorm = normalize(job.company);
  if (
    settings.excludedCompanies?.some((c) => companyNorm.includes(normalize(c)))
  ) {
    exclusions.push(`Company "${job.company}" is excluded`);
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Excluded company",
    };
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
    breakdown.roleMatch = 0;
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Role mismatch",
    };
  }
  breakdown.roleMatch = 90;
  reasons.push(`Title matches desired role`);

  const workMode = detectWorkMode(job);
  if (settings.workModes?.length && !settings.workModes.includes(workMode)) {
    if (workMode !== "UNKNOWN") {
      exclusions.push(`Work mode ${workMode} not in your preferences`);
      breakdown.locationMatch = 0;
      return {
        accepted: false,
        score: 0,
        classification: "REJECTED_BY_PREFERENCES",
        reasons,
        exclusions,
        concerns,
        breakdown,
        recommendation: "Work mode mismatch",
      };
    }
  }
  if (workMode !== "UNKNOWN") reasons.push(`Work mode: ${workMode}`);

  const locCheck = locationMatches(job, settings, workMode);
  breakdown.locationMatch = locCheck.ok ? 85 : 0;
  if (!locCheck.ok) {
    exclusions.push(locCheck.reason || "Location mismatch");
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Location mismatch",
    };
  }
  if (locCheck.reason) reasons.push(locCheck.reason);

  if (settings.salaryMin && job.salaryMax && job.salaryMax < settings.salaryMin) {
    exclusions.push(`Salary below minimum (${settings.salaryMin})`);
    breakdown.salaryMatch = 0;
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Salary below range",
    };
  }
  if (settings.salaryMax && job.salaryMin && job.salaryMin > settings.salaryMax) {
    exclusions.push(`Salary above maximum (${settings.salaryMax})`);
    breakdown.salaryMatch = 0;
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Salary above range",
    };
  }
  if (settings.salaryMin || settings.salaryMax) breakdown.salaryMatch = 80;

  const jobText = normalize(`${job.title} ${job.description}`);
  const matchedSkills = settings.requiredSkills.filter((s) =>
    jobText.includes(normalize(s))
  );
  if (matchedSkills.length === 0 && settings.requiredSkills.length > 0) {
    exclusions.push("Missing required skills");
    breakdown.skillMatch = 0;
    return {
      accepted: false,
      score: 0,
      classification: "REJECTED_BY_PREFERENCES",
      reasons,
      exclusions,
      concerns,
      breakdown,
      recommendation: "Skill mismatch",
    };
  }
  breakdown.skillMatch = Math.min(100, matchedSkills.length * 25);
  score += Math.min(25, matchedSkills.length * 8);
  if (matchedSkills.length) reasons.push(`Skills: ${matchedSkills.join(", ")}`);

  const preferredHits = (settings.preferredSkills || []).filter((s) =>
    jobText.includes(normalize(s))
  );
  score += Math.min(15, preferredHits.length * 5);
  if (preferredHits.length) reasons.push(`Preferred skills: ${preferredHits.join(", ")}`);

  if (settings.experienceYears != null) {
    const exp = settings.experienceYears;
    if (job.experienceMin != null && exp < job.experienceMin) {
      concerns.push(`Role may require ${job.experienceMin}+ years`);
      breakdown.experienceMatch = 40;
    } else {
      breakdown.experienceMatch = 85;
      reasons.push(`Experience level ~${exp} years`);
    }
    if (exp >= 5) score += 5;
  }

  if (settings.visaSponsorshipRequired && job.visaSponsorship === false) {
    concerns.push("Visa sponsorship may not be available");
  }

  if (job.postedAt) {
    const ageDays = Math.max(
      0,
      Math.floor((Date.now() - job.postedAt.getTime()) / (24 * 60 * 60 * 1000))
    );
    if (ageDays <= 7) {
      breakdown.freshnessScore = 100;
      score += 10;
      reasons.push(`Posted ${ageDays === 0 ? "today" : `${ageDays} days ago`}`);
    } else if (ageDays <= 30) {
      breakdown.freshnessScore = 75;
      score += 5;
      reasons.push(`Posted ${ageDays} days ago`);
    } else if (ageDays > 90) {
      breakdown.freshnessScore = 20;
      score -= 10;
      concerns.push(`Posting is ${ageDays} days old and may no longer be active`);
    }
  } else {
    concerns.push("Posting date is unavailable");
  }

  score = Math.min(100, Math.max(0, score));
  const accepted = score >= (settings.matchThreshold || 50);
  const classification = classifyScore(score, accepted);

  if (!accepted) {
    exclusions.push(`Match score ${score} below threshold ${settings.matchThreshold}`);
  } else {
    reasons.push(`Match score ${score} meets threshold`);
  }

  const recommendation =
    classification === "STRONG_MATCH"
      ? "Strong match — review and consider applying"
      : classification === "POSSIBLE_MATCH"
        ? "Possible match — review concerns before applying"
        : classification === "LOW_MATCH"
          ? "Low match — only pursue if you want to broaden search"
          : "Rejected by your preferences";

  return {
    accepted,
    score,
    classification,
    reasons,
    exclusions,
    concerns,
    breakdown,
    recommendation,
  };
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
