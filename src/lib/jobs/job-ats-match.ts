import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";

/**
 * Kairela Job ATS Match — a deterministic, explainable score of how well a
 * specific resume matches a specific job description. This is distinct from
 * the general Kairela ATS Readiness Score (resume quality in isolation) and
 * from the preference-based job Match Score (job vs. the user's stated
 * search preferences) — this engine only compares the resume's grounded,
 * extracted content against the job's stated requirements.
 *
 * Deterministic and grounded: no AI call, no randomness, and every point
 * awarded traces back to something literally present in the resume profile
 * or the job's own fields — keyword repetition never substitutes for a
 * genuine, evidenced match.
 */
export const JOB_ATS_MATCH_VERSION = "1.0.0";

export interface JobAtsMatchInput {
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  location: string | null;
}

export interface JobAtsCategoryScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface JobAtsMatch {
  totalScore: number;
  categories: JobAtsCategoryScore[];
  matchedRequirements: string[];
  missingRequirements: string[];
  missingKeywords: string[];
  matchingSkills: string[];
  experienceGaps: string[];
  eligibilityIssues: string[];
  hardBlockers: string[];
  recommendedAction: string;
  scoreVersion: string;
  generatedAt: string;
}

const WEIGHTS = {
  requiredSkillMatch: 20,
  preferredSkillMatch: 10,
  titleRelevance: 12,
  experienceRelevance: 12,
  seniorityAlignment: 8,
  industryRelevance: 6,
  educationRequirements: 6,
  responsibilityAlignment: 10,
  keywordCoverage: 6,
  locationEligibility: 6,
  formattingReadiness: 4,
} as const;

const SENIORITY_LEVELS: Array<{ level: number; markers: string[] }> = [
  { level: 0, markers: ["intern", "internship", "trainee"] },
  { level: 1, markers: ["junior", "associate", "entry"] },
  { level: 2, markers: [] }, // mid-level / unspecified default
  { level: 3, markers: ["senior", "sr."] },
  { level: 4, markers: ["staff", "lead", "principal"] },
  { level: 5, markers: ["director", "head of", "vp", "vice president"] },
];

function seniorityOf(text: string | null): number {
  if (!text) return 2;
  const lower = text.toLowerCase();
  if (
    /\b(staff nurse|nursing officer|registered nurse|clinical nurse|staff pharmacist)\b/.test(
      lower
    )
  ) {
    return 2;
  }
  for (let i = SENIORITY_LEVELS.length - 1; i >= 0; i--) {
    if (SENIORITY_LEVELS[i].markers.some((m) => lower.includes(m))) {
      return SENIORITY_LEVELS[i].level;
    }
  }
  return 2;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+.#]+/)
      .filter((t) => t.length > 2)
  );
}

function skillSetOf(profile: ParsedCareerProfile): Set<string> {
  return new Set(profile.skills.value.map(normalize));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreSkillMatch(
  jobSkills: string[],
  candidateSkills: Set<string>,
  weight: number
): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.length === 0) return { score: weight, matched: [], missing: [] };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of jobSkills) {
    if (candidateSkills.has(normalize(skill))) matched.push(skill);
    else missing.push(skill);
  }
  const ratio = matched.length / jobSkills.length;
  return { score: round1(ratio * weight), matched, missing };
}

function scoreTitleRelevance(
  profile: ParsedCareerProfile,
  jobTitle: string
): number {
  const candidateTitles = [
    ...(profile.currentRole.value ? [profile.currentRole.value] : []),
    ...profile.jobTitles.value,
  ];
  if (candidateTitles.length === 0) return 0;
  const jobTokens = tokenize(jobTitle);
  if (jobTokens.size === 0) return 0;

  let best = 0;
  for (const title of candidateTitles) {
    const titleTokens = tokenize(title);
    const overlap = [...jobTokens].filter((t) => titleTokens.has(t)).length;
    const ratio = overlap / jobTokens.size;
    if (ratio > best) best = ratio;
  }
  return round1(clamp(best, 0, 1) * WEIGHTS.titleRelevance);
}

function scoreExperienceRelevance(
  profile: ParsedCareerProfile,
  min: number | null,
  max: number | null,
  gaps: string[]
): number {
  const weight = WEIGHTS.experienceRelevance;
  const years = profile.experienceYears.value;
  if (min == null && max == null) return weight; // job doesn't specify — no penalty
  if (years == null) {
    gaps.push("Years of experience could not be confirmed against this job's requirement.");
    return weight * 0.4;
  }
  if (min != null && years < min) {
    const shortfall = min - years;
    gaps.push(`This role asks for ${min}+ years; the resume shows about ${years}.`);
    // Graduated penalty — small shortfalls cost less than large ones.
    return round1(clamp(weight - shortfall * (weight / Math.max(min, 1)), 0, weight));
  }
  if (max != null && years > max + 5) {
    gaps.push(`This role's range tops out around ${max} years; the resume shows more senior experience.`);
    return round1(weight * 0.7);
  }
  return weight;
}

function scoreSeniorityAlignment(profile: ParsedCareerProfile, jobTitle: string): number {
  const weight = WEIGHTS.seniorityAlignment;
  const candidateLevel = seniorityOf(profile.currentRole.value ?? profile.jobTitles.value[0] ?? null);
  const jobLevel = seniorityOf(jobTitle);
  const gap = Math.abs(candidateLevel - jobLevel);
  if (gap === 0) return weight;
  if (gap === 1) return round1(weight * 0.6);
  return round1(weight * 0.2);
}

function scoreIndustryRelevance(profile: ParsedCareerProfile, description: string): number {
  const weight = WEIGHTS.industryRelevance;
  const descTokens = tokenize(description);
  const candidateSkills = skillSetOf(profile);
  if (candidateSkills.size === 0 || descTokens.size === 0) return weight * 0.4;
  const overlap = [...candidateSkills].filter((s) => descTokens.has(s)).length;
  const ratio = clamp(overlap / Math.min(8, candidateSkills.size), 0, 1);
  return round1(ratio * weight);
}

function scoreEducationRequirements(
  profile: ParsedCareerProfile,
  description: string
): number {
  const weight = WEIGHTS.educationRequirements;
  const requirementPatterns = [
    /\b(gnm|general nursing and midwifery)\b/i,
    /\b(bsc|b\.?\s?sc\.?)\s+nursing\b/i,
    /\b(msc|m\.?\s?sc\.?)\s+nursing\b/i,
    /\b(b\.?\s?ed\.?|bachelor of education)\b/i,
    /\b(iti|industrial training institute)\b/i,
    /\bdiploma\b/i,
    /\b(bachelor|master|degree|b\.?s\.?|m\.?s\.?|phd)\b/i,
  ];
  const required = requirementPatterns.filter((pattern) => pattern.test(description));
  if (required.length === 0) return weight;
  const educationText = profile.education.value
    .flatMap((entry) => [
      entry.degree ?? "",
      entry.field ?? "",
      entry.evidence ?? "",
    ])
    .join(" ");
  const certificationText = profile.certifications.value.join(" ");
  const groundedQualifications = `${educationText} ${certificationText}`;
  if (!groundedQualifications.trim()) return round1(weight * 0.3);
  const matched = required.filter((pattern) => pattern.test(groundedQualifications));
  return round1((matched.length / required.length) * weight);
}

function groundedQualificationText(profile: ParsedCareerProfile): string {
  return [
    ...profile.education.value.flatMap((entry) => [
      entry.degree ?? "",
      entry.field ?? "",
      entry.evidence ?? "",
    ]),
    ...profile.certifications.value,
  ].join(" ");
}

function scoreResponsibilityAlignment(profile: ParsedCareerProfile, description: string): number {
  const weight = WEIGHTS.responsibilityAlignment;
  const descTokens = tokenize(description);
  const experienceText = profile.experience.value
    .map((e) => e.description ?? "")
    .join(" ");
  const expTokens = tokenize(experienceText);
  if (expTokens.size === 0 || descTokens.size === 0) return round1(weight * 0.3);
  const overlap = [...descTokens].filter((t) => expTokens.has(t)).length;
  const ratio = clamp(overlap / Math.min(30, descTokens.size), 0, 1);
  return round1(ratio * weight);
}

function scoreKeywordCoverage(
  jobRequiredAndPreferred: string[],
  description: string,
  profile: ParsedCareerProfile,
  missingKeywords: string[]
): number {
  const weight = WEIGHTS.keywordCoverage;
  const keywords = Array.from(
    new Set([...jobRequiredAndPreferred.map(normalize)])
  );
  if (keywords.length === 0) return weight;
  const candidateText = tokenize(
    [
      profile.skills.value.join(" "),
      profile.experience.value.map((e) => e.description ?? "").join(" "),
      profile.professionalSummary.value ?? "",
    ].join(" ")
  );
  let found = 0;
  for (const kw of keywords) {
    const present = kw.split(/\s+/).every((part) => candidateText.has(part));
    if (present) found++;
    else missingKeywords.push(kw);
  }
  return round1((found / keywords.length) * weight);
}

function scoreLocationEligibility(
  profile: ParsedCareerProfile,
  job: JobAtsMatchInput,
  eligibilityIssues: string[]
): number {
  const weight = WEIGHTS.locationEligibility;
  if (job.workMode === "REMOTE") return weight; // remote is eligible regardless of candidate location
  if (!job.location) return round1(weight * 0.7); // unknown — cannot confirm, but not a blocker
  const candidateLocation = profile.currentLocation.value;
  if (!candidateLocation) return round1(weight * 0.5);
  const jobLoc = normalize(job.location);
  const candLoc = normalize(candidateLocation);
  const sameArea =
    jobLoc.includes(candLoc.split(",")[0]) || candLoc.includes(jobLoc.split(",")[0]);
  if (sameArea) return weight;
  eligibilityIssues.push(
    `This role is ${job.workMode === "ONSITE" ? "on-site" : "hybrid"} in ${job.location}; the resume lists ${candidateLocation}.`
  );
  return round1(weight * 0.3);
}

/**
 * Scores a resume against one specific job. `readabilityScore0to1` should
 * come from the general Kairela ATS Readiness Score's readability category
 * (already computed once per resume) — this engine does not re-derive
 * formatting quality, it reuses it as the "formatting readiness" signal.
 */
export function calculateJobAtsMatch(
  profile: ParsedCareerProfile,
  job: JobAtsMatchInput,
  readabilityScore0to1: number
): JobAtsMatch {
  const experienceGaps: string[] = [];
  const eligibilityIssues: string[] = [];
  const missingKeywords: string[] = [];
  const hardBlockers: string[] = [];

  if (
    /\b(staff nurse|nursing officer|registered nurse|clinical nurse)\b/i.test(
      `${job.title} ${job.description}`
    ) &&
    /\b(registration|registered with|nursing council)\b/i.test(job.description) &&
    !/\b(registered nurse|nursing council|registration no|rn)\b/i.test(
      groundedQualificationText(profile)
    )
  ) {
    eligibilityIssues.push(
      "This nursing role states a registration requirement, but nursing registration was not confirmed in the resume."
    );
  }

  const candidateSkills = skillSetOf(profile);
  const required = scoreSkillMatch(job.requiredSkills, candidateSkills, WEIGHTS.requiredSkillMatch);
  const preferred = scoreSkillMatch(job.preferredSkills, candidateSkills, WEIGHTS.preferredSkillMatch);

  const categories: JobAtsCategoryScore[] = [
    { key: "requiredSkillMatch", label: "Required skill match", score: required.score, maxScore: WEIGHTS.requiredSkillMatch },
    { key: "preferredSkillMatch", label: "Preferred skill match", score: preferred.score, maxScore: WEIGHTS.preferredSkillMatch },
    { key: "titleRelevance", label: "Title relevance", score: scoreTitleRelevance(profile, job.title), maxScore: WEIGHTS.titleRelevance },
    {
      key: "experienceRelevance",
      label: "Experience relevance",
      score: scoreExperienceRelevance(profile, job.experienceMin, job.experienceMax, experienceGaps),
      maxScore: WEIGHTS.experienceRelevance,
    },
    { key: "seniorityAlignment", label: "Seniority alignment", score: scoreSeniorityAlignment(profile, job.title), maxScore: WEIGHTS.seniorityAlignment },
    { key: "industryRelevance", label: "Industry/domain relevance", score: scoreIndustryRelevance(profile, job.description), maxScore: WEIGHTS.industryRelevance },
    { key: "educationRequirements", label: "Education/certification requirements", score: scoreEducationRequirements(profile, job.description), maxScore: WEIGHTS.educationRequirements },
    { key: "responsibilityAlignment", label: "Responsibility alignment", score: scoreResponsibilityAlignment(profile, job.description), maxScore: WEIGHTS.responsibilityAlignment },
    {
      key: "keywordCoverage",
      label: "Keyword coverage",
      score: scoreKeywordCoverage([...job.requiredSkills, ...job.preferredSkills], job.description, profile, missingKeywords),
      maxScore: WEIGHTS.keywordCoverage,
    },
    { key: "locationEligibility", label: "Location/work-mode eligibility", score: scoreLocationEligibility(profile, job, eligibilityIssues), maxScore: WEIGHTS.locationEligibility },
    {
      key: "formattingReadiness",
      label: "Formatting readiness",
      score: round1(clamp(readabilityScore0to1, 0, 1) * WEIGHTS.formattingReadiness),
      maxScore: WEIGHTS.formattingReadiness,
    },
  ];

  // Hard exclusions — grounded, conservative triggers only.
  if (job.requiredSkills.length >= 3 && required.matched.length === 0) {
    hardBlockers.push("None of the job's required skills were found on the resume.");
  }
  if (job.experienceMin != null && profile.experienceYears.value != null) {
    const shortfall = job.experienceMin - profile.experienceYears.value;
    if (shortfall >= 5) {
      hardBlockers.push(
        `This role requires ${job.experienceMin}+ years; the resume shows significantly less.`
      );
    }
  }

  let totalScore = Math.round(categories.reduce((s, c) => s + c.score, 0));
  if (hardBlockers.length > 0) {
    totalScore = Math.min(totalScore, 40);
  }
  totalScore = clamp(totalScore, 0, 100);

  const recommendedAction =
    hardBlockers.length > 0
      ? "Likely not eligible — review the hard blockers before applying."
      : totalScore >= 75
        ? "Strong match — tailor and apply."
        : totalScore >= 50
          ? "Possible match — review gaps before applying."
          : "Weak match — consider only if the gaps are addressable.";

  return {
    totalScore,
    categories,
    matchedRequirements: [...required.matched, ...preferred.matched],
    missingRequirements: [...required.missing, ...preferred.missing],
    missingKeywords: Array.from(new Set(missingKeywords)),
    matchingSkills: required.matched.concat(preferred.matched),
    experienceGaps,
    eligibilityIssues,
    hardBlockers,
    recommendedAction,
    scoreVersion: JOB_ATS_MATCH_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
