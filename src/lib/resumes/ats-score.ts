import type { ParsedCareerProfile, ExperienceEntry, EducationEntry } from "./career-profile";

/**
 * Kairela ATS Readiness Score — a deterministic, explainable, general-purpose
 * resume-quality score. This is NOT an official Workday, Greenhouse, Lever,
 * Ashby, or LinkedIn score, and must never be presented as one. It is
 * entirely derived from the already-extracted, grounded ParsedCareerProfile
 * plus the raw resume text — no AI call, no randomness, so the same resume
 * always produces the same score.
 */
export const ATS_SCORE_VERSION = "1.0.0";

export type AtsRating = "Needs improvement" | "Good" | "Strong";

export interface AtsCategoryScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface AtsReadinessScore {
  totalScore: number;
  rating: AtsRating;
  ratingExplanation: string;
  categories: AtsCategoryScore[];
  strengths: string[];
  issues: string[];
  quickFixes: string[];
  missingSections: string[];
  formattingRisks: string[];
  extractionConfidence: number;
  scoreVersion: string;
  generatedAt: string;
}

const CATEGORY_WEIGHTS = {
  contactIdentity: 10,
  standardSections: 10,
  workExperienceStructure: 15,
  skillsClarity: 15,
  achievementEvidence: 15,
  readabilityFormatting: 10,
  dateConsistency: 10,
  educationCompleteness: 5,
  keywordClarity: 10,
} as const;

const TOTAL_WEIGHT = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0); // 100

const ACTION_VERBS = [
  "led",
  "built",
  "launched",
  "designed",
  "developed",
  "implemented",
  "improved",
  "increased",
  "reduced",
  "optimized",
  "managed",
  "delivered",
  "created",
  "drove",
  "grew",
  "automated",
  "migrated",
  "scaled",
  "shipped",
  "owned",
];

function hasMetricOrVerb(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const hasNumber = /\d/.test(text);
  const hasVerb = ACTION_VERBS.some((v) => lower.includes(v));
  return hasNumber || hasVerb;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---- Category scorers -----------------------------------------------------

function scoreContactIdentity(
  profile: ParsedCareerProfile,
  issues: string[],
  quickFixes: string[],
  missingSections: string[]
): number {
  const weight = CATEGORY_WEIGHTS.contactIdentity;
  let score = 0;
  if (profile.fullName.value) score += weight * 0.3;
  else {
    issues.push("Full name was not found.");
    quickFixes.push("Add your full name near the top of the resume.");
  }
  if (profile.email.value) score += weight * 0.3;
  else {
    issues.push("Email address was not found.");
    quickFixes.push("Add a professional email address in the header.");
    missingSections.push("contact email");
  }
  if (profile.phone.value) score += weight * 0.2;
  else quickFixes.push("Add a phone number so recruiters can reach you.");
  if (profile.currentLocation.value) score += weight * 0.2;
  else quickFixes.push("Add your city and state/country.");
  return round1(score);
}

function scoreStandardSections(
  profile: ParsedCareerProfile,
  missingSections: string[]
): number {
  const weight = CATEGORY_WEIGHTS.standardSections;
  const hasSummary = Boolean(profile.professionalSummary.value);
  const hasExperience = profile.experience.value.length > 0;
  const hasEducation = profile.education.value.length > 0;
  const hasSkills = profile.skills.value.length > 0;

  if (!hasSummary) missingSections.push("summary");
  if (!hasExperience) missingSections.push("experience");
  if (!hasEducation) missingSections.push("education");
  if (!hasSkills) missingSections.push("skills");

  const parts = [
    [hasSummary, 0.2],
    [hasExperience, 0.35],
    [hasEducation, 0.2],
    [hasSkills, 0.25],
  ] as const;
  const earned = parts.reduce((sum, [present, share]) => sum + (present ? share : 0), 0);
  return round1(earned * weight);
}

function scoreWorkExperienceStructure(
  profile: ParsedCareerProfile,
  issues: string[],
  quickFixes: string[]
): number {
  const weight = CATEGORY_WEIGHTS.workExperienceStructure;
  const entries = profile.experience.value;
  if (entries.length === 0) {
    issues.push("No work experience entries were detected.");
    quickFixes.push("Add your work experience with job title, company, and dates.");
    return 0;
  }

  const completeness = entries.map((e: ExperienceEntry) => {
    let points = 0;
    if (e.title) points += 0.35;
    if (e.company) points += 0.35;
    if (e.startDate) points += 0.15;
    if (e.endDate || e.current) points += 0.15;
    return points;
  });
  const avg = completeness.reduce((a, b) => a + b, 0) / completeness.length;

  const incomplete = entries.filter((e) => !e.title || !e.company).length;
  if (incomplete > 0) {
    issues.push(`${incomplete} experience ${incomplete === 1 ? "entry is" : "entries are"} missing a title or company.`);
    quickFixes.push("Make sure every role lists both a job title and a company name.");
  }

  return round1(avg * weight);
}

function scoreSkillsClarity(
  profile: ParsedCareerProfile,
  issues: string[],
  quickFixes: string[]
): number {
  const weight = CATEGORY_WEIGHTS.skillsClarity;
  const skillCount = profile.skills.value.length;
  if (skillCount === 0) {
    issues.push("No skills were detected.");
    quickFixes.push("Add a Skills section listing your key tools and technologies.");
    return 0;
  }
  // Scaled: 3 skills = partial credit, 10+ = full credit. Never rewards
  // keyword stuffing beyond this ceiling.
  const coverage = clamp(skillCount / 10, 0, 1);
  if (skillCount < 5) {
    quickFixes.push("List more of your core skills — aim for at least 5–10 relevant ones.");
  }
  return round1(coverage * weight);
}

function scoreAchievementEvidence(
  profile: ParsedCareerProfile,
  issues: string[],
  quickFixes: string[]
): number {
  const weight = CATEGORY_WEIGHTS.achievementEvidence;
  const entries = profile.experience.value;
  if (entries.length === 0) return 0;

  const withEvidence = entries.filter((e) => hasMetricOrVerb(e.description)).length;
  const ratio = withEvidence / entries.length;
  if (ratio < 0.5) {
    issues.push("Most experience entries describe responsibilities without measurable outcomes.");
    quickFixes.push(
      "Add numbers or outcomes to your bullet points (e.g. \"reduced load time by 30%\") instead of only listing duties."
    );
  }
  return round1(ratio * weight);
}

function scoreReadabilityFormatting(
  rawText: string,
  issues: string[],
  formattingRisks: string[]
): number {
  const weight = CATEGORY_WEIGHTS.readabilityFormatting;
  let score = weight;

  const length = rawText.trim().length;
  if (length < 400) {
    formattingRisks.push("insufficient readable text");
    issues.push("The extracted resume text is very short — this may be a scanned or image-based resume.");
    score -= weight * 0.5;
  } else if (length > 15000) {
    formattingRisks.push("overlong resume");
    issues.push("The resume is unusually long — consider trimming to 1–2 pages of content.");
    score -= weight * 0.2;
  }

  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
  const emptyLineRatio = 1 - lines.length / Math.max(1, rawText.split("\n").length);
  if (emptyLineRatio > 0.6) {
    formattingRisks.push("excessive blank space or empty sections");
    score -= weight * 0.1;
  }

  return round1(clamp(score, 0, weight));
}

function scoreDateConsistency(
  profile: ParsedCareerProfile,
  issues: string[]
): number {
  const weight = CATEGORY_WEIGHTS.dateConsistency;
  const entries = profile.experience.value;
  if (entries.length === 0) return weight * 0.5; // neutral — nothing to be inconsistent about

  const yearOf = (d: string | null): number | null => {
    if (!d) return null;
    const m = d.match(/\b(19|20)\d{2}\b/);
    return m ? parseInt(m[0], 10) : null;
  };

  let validCount = 0;
  let inconsistentCount = 0;
  for (const e of entries) {
    const start = yearOf(e.startDate);
    const end = e.current ? new Date().getFullYear() : yearOf(e.endDate);
    if (start == null) continue;
    validCount++;
    if (end != null && end < start) inconsistentCount++;
  }

  if (inconsistentCount > 0) {
    issues.push("Some employment dates appear out of order (end date before start date).");
  }
  if (validCount === 0) {
    issues.push("Employment dates could not be reliably parsed.");
    return round1(weight * 0.3);
  }

  const consistency = 1 - inconsistentCount / validCount;
  return round1(consistency * weight);
}

function scoreEducationCompleteness(profile: ParsedCareerProfile): number {
  const weight = CATEGORY_WEIGHTS.educationCompleteness;
  const entries = profile.education.value;
  if (entries.length === 0) return 0;
  const complete = entries.filter((e: EducationEntry) => e.degree && e.institution).length;
  return round1((complete / entries.length) * weight);
}

function scoreKeywordClarity(
  profile: ParsedCareerProfile,
  quickFixes: string[]
): number {
  const weight = CATEGORY_WEIGHTS.keywordClarity;
  let score = 0;
  if (profile.currentRole.value) score += weight * 0.35;
  else quickFixes.push("Make your current or most recent job title clear near the top of the resume.");
  if (profile.jobTitles.value.length > 0) score += weight * 0.35;
  if (profile.professionalSummary.value) score += weight * 0.3;
  else quickFixes.push("Add a short professional summary stating your role and focus area.");
  return round1(score);
}

function ratingFor(totalScore: number): { rating: AtsRating; explanation: string } {
  if (totalScore >= 80) {
    return {
      rating: "Strong",
      explanation: "80+ indicates the resume is well-structured, has clear sections, and includes measurable achievements.",
    };
  }
  if (totalScore >= 55) {
    return {
      rating: "Good",
      explanation: "55–79 indicates a solid foundation with a few gaps worth addressing before applying widely.",
    };
  }
  return {
    rating: "Needs improvement",
    explanation: "Below 55 indicates missing sections, weak structure, or limited evidence of impact — addressing the quick fixes below will help most.",
  };
}

function averageConfidence(profile: ParsedCareerProfile): number {
  const fields = [
    profile.fullName,
    profile.email,
    profile.phone,
    profile.currentLocation,
    profile.professionalSummary,
    profile.currentRole,
    profile.jobTitles,
    profile.experienceYears,
    profile.skills,
    profile.experience,
    profile.education,
  ];
  const sum = fields.reduce((s, f) => s + f.confidence, 0);
  return round1(sum / fields.length);
}

/**
 * Computes the Kairela ATS Readiness Score (0-100) for a parsed resume.
 * Deterministic: the same profile + rawText always produces the same score.
 */
export function calculateAtsReadinessScore(
  profile: ParsedCareerProfile,
  rawText: string
): AtsReadinessScore {
  const issues: string[] = [];
  const quickFixes: string[] = [];
  const missingSections: string[] = [];
  const formattingRisks: string[] = [];
  const strengths: string[] = [];

  const categories: AtsCategoryScore[] = [
    {
      key: "contactIdentity",
      label: "Contact and identity completeness",
      score: scoreContactIdentity(profile, issues, quickFixes, missingSections),
      maxScore: CATEGORY_WEIGHTS.contactIdentity,
    },
    {
      key: "standardSections",
      label: "Standard ATS sections",
      score: scoreStandardSections(profile, missingSections),
      maxScore: CATEGORY_WEIGHTS.standardSections,
    },
    {
      key: "workExperienceStructure",
      label: "Work-experience structure",
      score: scoreWorkExperienceStructure(profile, issues, quickFixes),
      maxScore: CATEGORY_WEIGHTS.workExperienceStructure,
    },
    {
      key: "skillsClarity",
      label: "Skills clarity and categorization",
      score: scoreSkillsClarity(profile, issues, quickFixes),
      maxScore: CATEGORY_WEIGHTS.skillsClarity,
    },
    {
      key: "achievementEvidence",
      label: "Achievement and impact evidence",
      score: scoreAchievementEvidence(profile, issues, quickFixes),
      maxScore: CATEGORY_WEIGHTS.achievementEvidence,
    },
    {
      key: "readabilityFormatting",
      label: "Readability and formatting safety",
      score: scoreReadabilityFormatting(rawText, issues, formattingRisks),
      maxScore: CATEGORY_WEIGHTS.readabilityFormatting,
    },
    {
      key: "dateConsistency",
      label: "Date and timeline consistency",
      score: scoreDateConsistency(profile, issues),
      maxScore: CATEGORY_WEIGHTS.dateConsistency,
    },
    {
      key: "educationCompleteness",
      label: "Education/certification completeness",
      score: scoreEducationCompleteness(profile),
      maxScore: CATEGORY_WEIGHTS.educationCompleteness,
    },
    {
      key: "keywordClarity",
      label: "Keyword clarity and role positioning",
      score: scoreKeywordClarity(profile, quickFixes),
      maxScore: CATEGORY_WEIGHTS.keywordClarity,
    },
  ];

  if (profile.skills.value.length >= 8) strengths.push("Strong, well-populated skills section.");
  if (profile.experience.value.length >= 2) strengths.push("Multiple work experience entries detected.");
  if (profile.professionalSummary.value) strengths.push("Includes a professional summary.");
  if (categories.find((c) => c.key === "achievementEvidence")!.score / CATEGORY_WEIGHTS.achievementEvidence >= 0.7) {
    strengths.push("Achievements are backed by measurable outcomes.");
  }

  const totalScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0)
  );
  const { rating, explanation } = ratingFor(totalScore);

  return {
    totalScore: clamp(totalScore, 0, TOTAL_WEIGHT),
    rating,
    ratingExplanation: explanation,
    categories,
    strengths,
    issues,
    quickFixes,
    missingSections: Array.from(new Set(missingSections)),
    formattingRisks: Array.from(new Set(formattingRisks)),
    extractionConfidence: averageConfidence(profile),
    scoreVersion: ATS_SCORE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
