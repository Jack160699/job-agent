import type { UserSettings, WorkMode, EmploymentType } from "@prisma/client";
import type { DiscoveredJob } from "./types";
import { selectCompanyBoards } from "./company-board-registry";
import {
  detectSeniority,
  isSeniorityCompatible,
  locationsAreCompatible,
  normalizeText,
  normalizeTitle,
  seniorityForExperience,
  titlesAreRelated,
} from "./normalization";

export const MATCH_CLASSIFICATION_VERSION = "2026-07-v3-public-three-state";

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
  validating_preferences: "Building your search plan",
  discovering_sources: "Checking target companies",
  fetching_jobs: "Searching relevant sources",
  filtering: "Evaluating requirements",
  deduplicating: "Removing duplicates",
  scoring: "Ranking opportunities",
  saving: "Preparing results",
  completed: "Complete",
  failed: "Failed",
};

export const SEARCH_STAGE_ORDER: SearchProgressStage[] = [
  "validating_preferences",
  "discovering_sources",
  "fetching_jobs",
  "deduplicating",
  "filtering",
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

export interface ProfileReadinessCategory {
  label: string;
  percent: number;
  missing: string[];
}

export interface ProfileReadiness {
  percent: number;
  requiredForSearch: ProfileReadinessCategory;
  requiredForApplication: ProfileReadinessCategory;
  optional: ProfileReadinessCategory;
}

function categoryReadiness(
  label: string,
  fields: Array<{ label: string; present: boolean }>
): ProfileReadinessCategory {
  const missing = fields.filter((f) => !f.present).map((f) => f.label);
  const percent =
    fields.length === 0
      ? 100
      : Math.round(((fields.length - missing.length) / fields.length) * 100);
  return { label, percent, missing };
}

/**
 * Phase B: "Profile ready: NN%" — only asks for fields that are absent.
 * Required-for-search fields gate whether a search can run at all;
 * required-for-application fields gate whether Kairela can safely apply on
 * the user's behalf; optional fields only refine ranking. The overall
 * percent weights search readiness heaviest since it unblocks everything
 * else in the end-to-end flow.
 */
export function calculateProfileReadiness(
  settings: UserSettings | null
): ProfileReadiness {
  const requiredForSearch = categoryReadiness("Required to search", [
    { label: "Target job titles", present: Boolean(settings?.jobTitles?.length) },
    { label: "Primary skills", present: Boolean(settings?.requiredSkills?.length) },
    {
      label: "Preferred locations or remote",
      present: Boolean(
        settings?.locations?.length || settings?.workModes?.includes("REMOTE")
      ),
    },
    { label: "Work mode (remote/hybrid/onsite)", present: Boolean(settings?.workModes?.length) },
    { label: "Total years of experience", present: settings?.experienceYears != null },
  ]);

  const requiredForApplication = categoryReadiness("Required to apply", [
    { label: "Notice period", present: settings?.noticePeriodDays != null },
    {
      label: "Expected or current salary",
      present:
        settings?.salaryMin != null ||
        settings?.salaryMax != null ||
        settings?.currentSalary != null,
    },
    { label: "Employment type", present: Boolean(settings?.employmentTypes?.length) },
    { label: "Relocation willingness", present: settings != null },
    { label: "Work authorization", present: Boolean(settings?.workAuthorization) },
  ]);

  const optional = categoryReadiness("Optional", [
    { label: "Preferred industries", present: Boolean(settings?.industries?.length) },
    { label: "Target companies", present: Boolean(settings?.targetCompanies?.length) },
    { label: "Preferred company size", present: Boolean(settings?.companySizes?.length) },
    { label: "Travel willingness", present: Boolean(settings?.travelWillingness) },
  ]);

  const percent = Math.round(
    requiredForSearch.percent * 0.5 +
      requiredForApplication.percent * 0.35 +
      optional.percent * 0.15
  );

  return { percent, requiredForSearch, requiredForApplication, optional };
}

export type MatchClassification =
  | "STRONG"
  | "POSSIBLE"
  | "LOW"
  | "POTENTIAL_MATCH_REQUIRES_VERIFICATION"
  | "REJECTED";

export type RejectionReasonCode =
  | "title_mismatch"
  | "profession_mismatch"
  | "location_mismatch"
  | "work_mode_mismatch"
  | "experience_too_high"
  | "experience_too_low"
  | "qualification_mismatch"
  | "salary_mismatch"
  | "sector_mismatch"
  | "excluded_keyword"
  | "company_excluded"
  | "expired"
  | "duplicate"
  | "invalid_url"
  | "insufficient_metadata"
  | "likely_non_job_page"
  | "unknown_eligibility"
  | "low_confidence_public_snippet"
  | "seniority_mismatch"
  | "below_match_threshold"
  | "other";

export interface MatchBreakdown {
  roleMatch: number;
  skillMatch: number;
  locationMatch: number;
  salaryMatch: number;
  experienceMatch: number;
  seniorityMatch: number;
  workModeMatch: number;
  industryMatch: number;
  employmentTypeMatch: number;
  visaMatch: number;
  freshnessScore: number;
}

export interface JobFilterResult {
  accepted: boolean;
  score: number;
  classification: MatchClassification;
  reasons: string[];
  exclusions: string[];
  concerns: string[];
  uncertain: string[];
  breakdown: MatchBreakdown;
  recommendation: string;
  classificationVersion: string;
  rejectionCode?: RejectionReasonCode;
  requiresVerification?: boolean;
  matchedSignals?: string[];
  unknownSignals?: string[];
  isPublicDiscovery?: boolean;
}

function normalize(text: string): string {
  return normalizeText(text);
}

function titleMatches(jobTitle: string, preferredTitles: string[]): boolean {
  return preferredTitles.some((preferred) =>
    titlesAreRelated(preferred, jobTitle)
  );
}

const PROFESSION_EVIDENCE: Record<
  string,
  { label: string; terms: string[] }
> = {
  nursing_healthcare: {
    label: "Healthcare qualifications and setting",
    terms: [
      "nursing",
      "registered nurse",
      "staff nurse",
      "gnm",
      "bsc nursing",
      "msc nursing",
      "registration",
      "patient care",
      "clinical",
      "hospital",
      "ward",
      "icu",
      "ot",
      "medical claims",
      "healthcare",
      "claims",
      "medical",
    ],
  },
  teaching_education: {
    label: "Education qualifications and teaching context",
    terms: [
      "b ed",
      "bed",
      "teaching",
      "teacher",
      "lecturer",
      "faculty",
      "subject",
      "curriculum",
      "academic",
      "school",
      "college",
      "university",
      "classroom",
      "trainer",
    ],
  },
  banking: {
    label: "Banking and finance evidence",
    terms: [
      "banking",
      "bcom",
      "commerce",
      "finance",
      "accounts",
      "credit",
      "loans",
      "risk",
      "compliance",
      "kyc",
      "aml",
      "reconciliation",
      "customer service",
      "clerical",
      "probationary officer",
      "excel",
    ],
  },
  technician_apprentice: {
    label: "Trade and engineering evidence",
    terms: [
      "diploma",
      "iti",
      "trade",
      "apprentice",
      "maintenance",
      "electrical",
      "mechanical",
      "electronics",
      "field service",
      "plant",
      "machinery",
      "technician",
      "junior engineer",
    ],
  },
  operations_analysis: {
    label: "Operations and process evidence",
    terms: [
      "operations",
      "implementation",
      "process",
      "onboarding",
      "support",
      "excel",
      "sql",
      "jira",
      "reporting",
      "mis",
      "service delivery",
      "client coordination",
      "apis",
    ],
  },
  software_engineering: {
    label: "Software engineering evidence",
    terms: [
      "software",
      "developer",
      "engineer",
      "typescript",
      "javascript",
      "react",
      "node",
      "java",
      "python",
      "sql",
      "fresher",
      "graduate",
      "trainee",
      "junior",
    ],
  },
};

function addProfessionEvidence(
  family: string | null,
  jobText: string,
  reasons: string[]
): number {
  if (!family) return 0;
  const profile = PROFESSION_EVIDENCE[family];
  if (!profile) return 0;
  const matches = [...new Set(profile.terms.filter((term) => jobText.includes(term)))];
  if (!matches.length) return 0;
  reasons.push(`${profile.label}: ${matches.slice(0, 4).join(", ")}`);
  return Math.min(15, matches.length * 3);
}

export function detectWorkMode(job: DiscoveredJob): WorkMode {
  if (job.workMode && job.workMode !== "UNKNOWN") return job.workMode;
  const text = normalize(
    `${job.title || ""} ${job.location || ""} ${job.description || ""}`
  );
  if (/\b(remote|work from home|wfh)\b/.test(text)) return "REMOTE";
  if (/\bhybrid\b/.test(text)) return "HYBRID";
  // Explicit onsite/office wording only. A city name alone must stay UNKNOWN —
  // public-discovery results often carry a search-preference location stamp
  // that previously fabricated false ONSITE mismatches for remote-only users.
  if (
    /\b(onsite|on site|in office|office based|work from office|wfo)\b/.test(text)
  ) {
    return "ONSITE";
  }
  return "UNKNOWN";
}

function isPublicDiscoveryJob(job: DiscoveredJob): boolean {
  return (
    job.metadata?.provenance === "public_discovery" ||
    job.metadata?.discoveryMethod === "public_index" ||
    job.metadata?.verificationState === "indexed_public_metadata"
  );
}

function clearSeniorityConflict(
  title: string,
  description: string,
  experienceYears: number | null
): boolean {
  if (experienceYears != null && experienceYears > 2) return false;
  const titleText = normalize(title);
  if (/\bstaff nurse\b/.test(titleText)) {
    return /\b(senior|lead|principal|manager|director|architect|head of)\b/.test(
      titleText
    );
  }
  if (
    /\b(senior|lead|staff|principal|manager|director|architect|head of)\b/.test(
      titleText
    )
  ) {
    return true;
  }
  const desc = normalize(description);
  return /\b([5-9]|1[0-9]|10)\+?\s*(\+|plus)?\s*years?\b/.test(desc);
}

function classifyScore(
  score: number,
  accepted: boolean,
  potential: boolean
): MatchClassification {
  if (!accepted && !potential) return "REJECTED";
  if (potential) return "POTENTIAL_MATCH_REQUIRES_VERIFICATION";
  if (score >= 80) return "STRONG";
  if (score >= 65) return "POSSIBLE";
  return "LOW";
}

function locationMatches(
  job: DiscoveredJob,
  settings: UserSettings
): { ok: boolean; reason?: string; uncertain?: boolean } {
  if (
    [
      "UPSC",
      "ISRO",
      "NTPC",
      "BEL",
      "IOCL",
      "IBPS",
      "RAILWAYS",
      "SSC",
      "DRDO",
      "RBI",
    ].includes(job.source) &&
    normalize(job.location || "") === "india"
  ) {
    return {
      ok: true,
      reason: "Nationwide official recruitment; verify the posting location",
      uncertain: true,
    };
  }

  if (!job.location?.trim()) {
    return {
      ok: true,
      reason: "Location was not stated; verify on the source listing",
      uncertain: true,
    };
  }

  const result = locationsAreCompatible(settings.locations, job.location, {
    remotePreferred: settings.workModes.includes("REMOTE"),
    willingToRelocate: settings.willingToRelocate,
  });
  return { ok: result.matched, reason: result.reason, uncertain: result.uncertain };
}

export function evaluateJobAgainstPreferences(
  job: DiscoveredJob,
  settings: UserSettings
): JobFilterResult {
  const reasons: string[] = [];
  const exclusions: string[] = [];
  const concerns: string[] = [];
  const uncertain: string[] = [];
  const matchedSignals: string[] = [];
  const unknownSignals: string[] = [];
  let rejectionCode: RejectionReasonCode | undefined;
  let score = 35;
  const isPublic = isPublicDiscoveryJob(job);
  const breakdown: MatchBreakdown = {
    roleMatch: 0,
    skillMatch: 0,
    locationMatch: 0,
    salaryMatch: 50,
    experienceMatch: 50,
    seniorityMatch: 50,
    workModeMatch: 50,
    industryMatch: 50,
    employmentTypeMatch: 50,
    visaMatch: 50,
    freshnessScore: 50,
  };

  const finish = (
    accepted: boolean,
    recommendation: string,
    options: {
      potential?: boolean;
      rejectionCode?: RejectionReasonCode;
    } = {}
  ): JobFilterResult => {
    const potential = Boolean(options.potential);
    const finalAccepted = accepted || potential;
    return {
      accepted: finalAccepted,
      score: finalAccepted ? Math.min(100, Math.max(0, score)) : 0,
      classification: classifyScore(score, accepted, potential),
      reasons,
      exclusions,
      concerns,
      uncertain,
      breakdown,
      recommendation,
      classificationVersion: MATCH_CLASSIFICATION_VERSION,
      rejectionCode: options.rejectionCode ?? rejectionCode,
      requiresVerification: potential || uncertain.length > 0,
      matchedSignals,
      unknownSignals: [...unknownSignals, ...uncertain],
      isPublicDiscovery: isPublic,
    };
  };

  if (!job.location && !job.description && !isPublic) {
    exclusions.push("Insufficient job information to evaluate");
    return finish(false, "Rejected — missing location and description", {
      rejectionCode: "insufficient_metadata",
    });
  }
  if (isPublic && !job.title?.trim()) {
    exclusions.push("Insufficient job information to evaluate");
    return finish(false, "Rejected — missing title", {
      rejectionCode: "insufficient_metadata",
    });
  }

  const companyNorm = normalize(job.company);
  if (
    settings.excludedCompanies?.some((c) => companyNorm.includes(normalize(c)))
  ) {
    exclusions.push(`Company "${job.company}" is excluded`);
    return finish(false, "Rejected — excluded company", {
      rejectionCode: "company_excluded",
    });
  }

  if (settings.targetCompanies?.length) {
    const included = settings.targetCompanies.some((c) =>
      companyNorm.includes(normalize(c))
    );
    if (included) {
      score += 15;
      reasons.push(`Target company: ${job.company}`);
      matchedSignals.push("target_company");
    }
  }

  if (!titleMatches(job.title, settings.jobTitles)) {
    exclusions.push(`Title "${job.title}" does not match desired roles`);
    return finish(false, "Rejected — role mismatch", {
      rejectionCode: "title_mismatch",
    });
  }
  breakdown.roleMatch = 100;
  score += 20;
  reasons.push("Title matches a target or explicitly adjacent role");
  matchedSignals.push("title_family");

  const jobText = normalize(`${job.title} ${job.description}`);
  if (clearSeniorityConflict(job.title, job.description || "", settings.experienceYears)) {
    exclusions.push(
      "Clear seniority conflict: senior/lead/manager/high experience role for this profile"
    );
    return finish(false, "Rejected — seniority mismatch", {
      rejectionCode: "seniority_mismatch",
    });
  }

  const userSeniority = seniorityForExperience(settings.experienceYears);
  const roleSeniority = detectSeniority(`${job.title} ${job.description}`);
  const seniority = isSeniorityCompatible(
    userSeniority,
    roleSeniority,
    settings.employmentTypes.includes("INTERNSHIP") ||
      /\b(trainee|apprentice)\b/.test(jobText)
  );
  if (!seniority.compatible) {
    breakdown.seniorityMatch = 0;
    exclusions.push(seniority.reason ?? "Seniority mismatch");
    return finish(false, "Rejected — seniority mismatch", {
      rejectionCode: "seniority_mismatch",
    });
  }
  breakdown.seniorityMatch =
    roleSeniority === "UNKNOWN" ? 50 : roleSeniority === userSeniority ? 100 : 75;
  if (roleSeniority === "UNKNOWN") {
    uncertain.push("Seniority was not stated");
    unknownSignals.push("seniority");
  } else {
    reasons.push(`Seniority ${roleSeniority.toLowerCase()} is compatible`);
    matchedSignals.push("seniority");
  }

  const workMode = detectWorkMode(job);
  if (settings.workModes?.length && !settings.workModes.includes(workMode)) {
    if (workMode !== "UNKNOWN") {
      exclusions.push(`Work mode ${workMode} not in your preferences`);
      breakdown.workModeMatch = 0;
      return finish(false, "Rejected — work mode mismatch", {
        rejectionCode: "work_mode_mismatch",
      });
    }
  }
  if (workMode !== "UNKNOWN") {
    breakdown.workModeMatch = 100;
    score += 5;
    reasons.push(`Work mode ${workMode.toLowerCase()} is selected`);
    matchedSignals.push("work_mode");
  } else {
    uncertain.push("Work mode was not stated");
    unknownSignals.push("work_mode");
  }

  const locCheck = locationMatches(job, settings);
  if (!locCheck.ok && locCheck.uncertain) {
    breakdown.locationMatch = 50;
    uncertain.push(locCheck.reason || "Location eligibility is unconfirmed");
    unknownSignals.push("location");
    score += 3;
  } else if (!locCheck.ok) {
    breakdown.locationMatch = 0;
    exclusions.push(locCheck.reason || "Location mismatch");
    return finish(false, "Rejected — location mismatch", {
      rejectionCode: "location_mismatch",
    });
  } else if (locCheck.uncertain) {
    breakdown.locationMatch = 60;
    uncertain.push(locCheck.reason || "Location needs verification on source");
    unknownSignals.push("location");
    score += 5;
    if (locCheck.reason) reasons.push(locCheck.reason);
  } else {
    breakdown.locationMatch = 85;
    score += 10;
    if (locCheck.reason) reasons.push(locCheck.reason);
    matchedSignals.push("location");
  }

  const salaryComparable =
    !job.salaryCurrency ||
    normalize(job.salaryCurrency) === normalize(settings.salaryCurrency);
  if (
    settings.salaryMin &&
    job.salaryMax &&
    salaryComparable &&
    job.salaryMax < settings.salaryMin
  ) {
    exclusions.push(
      `Salary ${job.salaryMax} ${job.salaryCurrency ?? settings.salaryCurrency} is below minimum ${settings.salaryMin} ${settings.salaryCurrency}`
    );
    breakdown.salaryMatch = 0;
    return finish(false, "Rejected — salary below range", {
      rejectionCode: "salary_mismatch",
    });
  }
  if ((settings.salaryMin || settings.salaryMax) && !salaryComparable) {
    uncertain.push(
      `Salary currency ${job.salaryCurrency} cannot be compared with ${settings.salaryCurrency}`
    );
    unknownSignals.push("salary");
  } else if (settings.salaryMin || settings.salaryMax) {
    breakdown.salaryMatch = job.salaryMin || job.salaryMax ? 90 : 50;
    if (!job.salaryMin && !job.salaryMax) {
      uncertain.push("Salary was not stated");
      unknownSignals.push("salary");
    } else {
      matchedSignals.push("salary");
    }
  }

  const matchedTitleFamily =
    normalizeTitle(job.title).family ??
    settings.jobTitles.map((title) => normalizeTitle(title).family).find(Boolean) ??
    null;
  const matchedSkills = settings.requiredSkills.filter((s) =>
    jobText.includes(normalize(s))
  );
  if (matchedSkills.length === 0 && settings.requiredSkills.length > 0) {
    breakdown.skillMatch = 0;
    if (isPublic) {
      uncertain.push(
        "Skills were not confirmed in the public snippet; verify on the source listing"
      );
      unknownSignals.push("skills");
      concerns.push(
        "Potential match — open source to verify skills and eligibility"
      );
    } else {
      concerns.push(
        "No requested skill was verified in the source text; review the full posting before applying"
      );
      uncertain.push(
        "The source may provide a shortened description without its full requirements"
      );
      score -= 5;
    }
  } else if (matchedSkills.length) {
    breakdown.skillMatch = Math.min(100, matchedSkills.length * 25);
    score += Math.min(25, matchedSkills.length * 8);
    reasons.push(`Skills: ${matchedSkills.join(", ")}`);
    matchedSignals.push("skills");
  }

  score += addProfessionEvidence(matchedTitleFamily, jobText, reasons);
  if (matchedTitleFamily) matchedSignals.push("profession_family");

  const preferredHits = (settings.preferredSkills || []).filter((s) =>
    jobText.includes(normalize(s))
  );
  score += Math.min(15, preferredHits.length * 5);
  if (preferredHits.length) {
    reasons.push(`Preferred skills: ${preferredHits.join(", ")}`);
  }

  if (settings.experienceYears != null) {
    const exp = settings.experienceYears;
    if (job.experienceMin != null && exp < job.experienceMin) {
      const entryFriendly =
        exp <= 1 &&
        /\b(entry level|entry|fresher|graduate|trainee|intern|internship|apprentice|junior|associate|0\s*[-–to]+\s*[12]\s*years?)\b/.test(
          jobText
        );
      if (entryFriendly) {
        breakdown.experienceMatch = 60;
        concerns.push(
          `The posting states ${job.experienceMin}+ years, but also identifies the role as entry-level, graduate, trainee, intern, or apprentice`
        );
        reasons.push("Fresher-friendly wording keeps this role reviewable");
      } else {
        exclusions.push(
          `Role requires ${job.experienceMin}+ years; profile has ${exp}`
        );
        breakdown.experienceMatch = 0;
        return finish(false, "Rejected — experience requirement mismatch", {
          rejectionCode: "experience_too_high",
        });
      }
    } else if (job.experienceMin == null && isPublic) {
      uncertain.push("Experience requirement was not stated");
      unknownSignals.push("experience");
    } else {
      breakdown.experienceMatch = 85;
      reasons.push(`Experience requirement is compatible with ${exp} years`);
      matchedSignals.push("experience");
    }
  }

  if (settings.visaSponsorshipRequired && job.visaSponsorship === false) {
    exclusions.push("Visa sponsorship is required but unavailable");
    breakdown.visaMatch = 0;
    return finish(false, "Rejected — sponsorship constraint", {
      rejectionCode: "unknown_eligibility",
    });
  }
  if (settings.visaSponsorshipRequired && job.visaSponsorship == null) {
    uncertain.push("Visa sponsorship availability is unknown");
    unknownSignals.push("visa");
  } else {
    breakdown.visaMatch = 100;
  }

  if (
    job.employmentType &&
    job.employmentType !== "UNKNOWN" &&
    settings.employmentTypes.length > 0
  ) {
    if (!settings.employmentTypes.includes(job.employmentType)) {
      exclusions.push(
        `Employment type ${job.employmentType} was not selected`
      );
      breakdown.employmentTypeMatch = 0;
      return finish(false, "Rejected — employment type mismatch", {
        rejectionCode: "other",
      });
    }
    breakdown.employmentTypeMatch = 100;
    reasons.push(
      `Employment type ${job.employmentType.toLowerCase()} is selected`
    );
  } else if (settings.employmentTypes.length > 0) {
    uncertain.push("Employment type was not stated");
    unknownSignals.push("employment_type");
  }

  if (settings.industries.length > 0) {
    const industryText = normalize(
      `${job.industry ?? ""} ${String(job.metadata?.industry ?? "")} ${job.description}`
    );
    const industryMatched = settings.industries.some((industry) =>
      industryText.includes(normalize(industry))
    );
    if (industryMatched) {
      breakdown.industryMatch = 100;
      reasons.push("Industry matches a selected industry");
      score += 5;
      matchedSignals.push("industry");
    } else if (job.industry || job.metadata?.industry) {
      exclusions.push("Industry does not match selected industries");
      breakdown.industryMatch = 0;
      return finish(false, "Rejected — industry mismatch", {
        rejectionCode: "sector_mismatch",
      });
    } else {
      uncertain.push("Industry was not stated");
      unknownSignals.push("industry");
    }
  }

  if (job.closesAt && job.closesAt.getTime() < Date.now()) {
    exclusions.push("Application closing date has passed");
    return finish(false, "Rejected — posting expired", {
      rejectionCode: "expired",
    });
  }
  if (job.removedAt) {
    exclusions.push("The source removed this posting");
    return finish(false, "Rejected — posting removed", {
      rejectionCode: "expired",
    });
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
      breakdown.freshnessScore = 0;
      exclusions.push(`Posting is ${ageDays} days old`);
      return finish(false, "Rejected — posting is stale", {
        rejectionCode: "expired",
      });
    }
  } else {
    uncertain.push("Posting date is unavailable");
    unknownSignals.push("posted_at");
  }

  score = Math.min(100, Math.max(0, score));
  const threshold = settings.matchThreshold || 50;
  const meetsThreshold = score >= threshold;
  const potential =
    isPublic &&
    !meetsThreshold &&
    exclusions.length === 0 &&
    matchedSignals.includes("title_family");

  if (!meetsThreshold && !potential) {
    exclusions.push(`Match score ${score} below threshold ${threshold}`);
    return finish(false, "Rejected by your preferences", {
      rejectionCode: "below_match_threshold",
    });
  }

  if (potential) {
    reasons.push(
      `Public listing matches the role family but scored ${score} with incomplete metadata`
    );
    concerns.push("Potential match — open source to verify");
    return finish(false, "Potential match — open source to verify", {
      potential: true,
    });
  }

  reasons.push(`Match score ${score} meets threshold`);
  const classification = classifyScore(score, true, false);
  const recommendation =
    classification === "STRONG"
      ? "Strong match — review and consider applying"
      : classification === "POSSIBLE"
        ? "Possible match — review concerns before applying"
        : "Low match — only pursue if you want to broaden search";

  return finish(true, recommendation);
}


export function buildDiscoveryBoards(settings: UserSettings): {
  greenhouse: string[];
  lever: string[];
  ashby: string[];
  workday: string[];
} {
  return selectCompanyBoards(settings);
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
  sectorPreference: string;
  governmentCategories: string[];
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
    sectorPreference: settings.sectorPreference,
    governmentCategories: settings.governmentCategories,
    preferencesComplete: settings.preferencesComplete,
  };
}
