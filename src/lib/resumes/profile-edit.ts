import type {
  EducationEntry,
  ExperienceEntry,
  ExtractedField,
  ParsedCareerProfile,
  ProjectEntry,
} from "./career-profile";

/**
 * Phase A: user edits to structured resume sections. Only the sections the
 * user actually touched are included — everything else in the profile is
 * left exactly as extracted (deterministic or AI-enriched).
 */
export interface ProfileEdits {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  currentLocation?: string | null;
  currentRole?: string | null;
  jobTitles?: string[];
  skills?: string[];
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  professionalSummary?: string | null;
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  projects?: ProjectEntry[];
  certifications?: string[];
  languages?: string[];
}

function userConfirmed<T>(value: T): ExtractedField<T> {
  // A field the user directly typed or rearranged is the most trustworthy
  // signal there is — full confidence, never flagged for re-review, and
  // (per the fill-only-if-empty rule in enhanceCareerProfileWithAI) never
  // overwritten by a later AI enrichment pass since the array is non-empty.
  return {
    value,
    confidence: 1,
    source: "user_edit",
    directlyFound: true,
    needsReview: false,
  };
}

export function applyProfileEdits(
  current: ParsedCareerProfile,
  edits: ProfileEdits
): ParsedCareerProfile {
  const next: ParsedCareerProfile = { ...current };

  if (edits.fullName !== undefined) next.fullName = userConfirmed(edits.fullName);
  if (edits.email !== undefined) next.email = userConfirmed(edits.email);
  if (edits.phone !== undefined) next.phone = userConfirmed(edits.phone);
  if (edits.currentLocation !== undefined) {
    next.currentLocation = userConfirmed(edits.currentLocation);
  }
  if (edits.currentRole !== undefined) {
    next.currentRole = userConfirmed(edits.currentRole);
  }
  if (edits.jobTitles !== undefined) {
    next.jobTitles = userConfirmed(edits.jobTitles);
  }
  if (edits.skills !== undefined) next.skills = userConfirmed(edits.skills);
  if (edits.linkedinUrl !== undefined) {
    next.linkedinUrl = userConfirmed(edits.linkedinUrl);
  }
  if (edits.githubUrl !== undefined) {
    next.githubUrl = userConfirmed(edits.githubUrl);
  }
  if (edits.portfolioUrl !== undefined) {
    next.portfolioUrl = userConfirmed(edits.portfolioUrl);
  }
  if (edits.professionalSummary !== undefined) {
    next.professionalSummary = userConfirmed(edits.professionalSummary);
  }
  if (edits.experience !== undefined) {
    next.experience = userConfirmed(edits.experience);
  }
  if (edits.education !== undefined) {
    next.education = userConfirmed(edits.education);
  }
  if (edits.projects !== undefined) {
    next.projects = userConfirmed(edits.projects);
  }
  if (edits.certifications !== undefined) {
    next.certifications = userConfirmed(edits.certifications);
  }
  if (edits.languages !== undefined) {
    next.languages = userConfirmed(edits.languages);
  }

  return next;
}

const PROTECTED_PROFILE_SOURCES = new Set([
  "user_edit",
  "user_confirmed",
  "onboarding",
  "answer_bank",
]);

/**
 * Reprocessing a resume may improve extracted fields, but it must never
 * silently replace information the candidate explicitly edited or confirmed.
 * The fresh parse remains authoritative for unconfirmed extracted fields.
 */
export function mergeExtractedProfilePreservingUserEdits(
  current: ParsedCareerProfile | null | undefined,
  extracted: ParsedCareerProfile
): ParsedCareerProfile {
  if (!current) return extracted;

  const next = { ...extracted };
  const keys: Array<Exclude<keyof ParsedCareerProfile, "meta">> = [
    "fullName",
    "email",
    "phone",
    "currentLocation",
    "professionalSummary",
    "currentRole",
    "jobTitles",
    "experienceYears",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "languages",
    "linkedinUrl",
    "githubUrl",
    "portfolioUrl",
  ];

  for (const key of keys) {
    const field = current[key];
    if (field && PROTECTED_PROFILE_SOURCES.has(field.source ?? "")) {
      Object.assign(next, { [key]: field });
    }
  }

  return next;
}
