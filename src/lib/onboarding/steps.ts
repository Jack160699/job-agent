import type { UserPersona } from "@prisma/client";

export type OnboardingStepId =
  | "welcome"
  | "resume"
  | "review"
  | "preferences"
  | "hiring_basics"
  | "complete";

export interface PersonaChoice {
  id: UserPersona;
  title: string;
  description: string;
  requiresFlag?: "employerMode" | "recruiterMode" | "agencyMode";
}

export const PERSONA_CHOICES: PersonaChoice[] = [
  {
    id: "JOB_SEEKER",
    title: "Find my next job",
    description: "Discover relevant roles, tailor your resume, and track applications.",
  },
  {
    id: "EMPLOYER",
    title: "Hire candidates",
    description: "Build your hiring profile and prepare to post roles.",
    requiresFlag: "employerMode",
  },
  {
    id: "RECRUITER",
    title: "Recruit for clients",
    description: "Manage pipelines and outreach for multiple clients.",
    requiresFlag: "recruiterMode",
  },
  {
    id: "AGENCY",
    title: "Run a recruitment agency",
    description: "Coordinate recruiters, clients, and candidates.",
    requiresFlag: "agencyMode",
  },
  {
    id: "EXPLORER",
    title: "Explore the platform",
    description: "Look around before committing to a path.",
  },
];

export const JOB_SEEKER_STEPS: OnboardingStepId[] = [
  "welcome",
  "resume",
  "review",
  "preferences",
  "complete",
];

export const HIRING_STEPS: OnboardingStepId[] = [
  "welcome",
  "hiring_basics",
  "complete",
];

export const STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "What would you like Kairela to help you accomplish?",
  resume: "Start with your resume",
  review: "We found these details",
  preferences: "Tell us what your resume can't",
  hiring_basics: "Tell us about your hiring needs",
  complete: "You're all set",
};

export const STEP_WHY: Record<OnboardingStepId, string> = {
  welcome: "This helps Kairela personalize your dashboard and recommendations.",
  resume:
    "Upload your resume and Kairela will prepare most of your career profile for you.",
  review: "Review and edit everything before it becomes part of your profile.",
  preferences:
    "We only ask what your resume couldn't answer — target roles, locations, and how you want to apply.",
  hiring_basics: "This prepares your hiring workspace for when employer features launch.",
  complete: "Your profile is ready. You can update any of this in Settings.",
};

export function stepsForPersona(persona: UserPersona): OnboardingStepId[] {
  if (persona === "JOB_SEEKER" || persona === "EXPLORER") return JOB_SEEKER_STEPS;
  return HIRING_STEPS;
}

export function nextStep(
  persona: UserPersona,
  current: OnboardingStepId
): OnboardingStepId | null {
  const steps = stepsForPersona(persona);
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}

export function prevStep(
  persona: UserPersona,
  current: OnboardingStepId
): OnboardingStepId | null {
  const steps = stepsForPersona(persona);
  const idx = steps.indexOf(current);
  if (idx <= 0) return null;
  return steps[idx - 1];
}

export interface OnboardingDraft {
  persona?: UserPersona;
  fullName?: string;
  currentLocation?: string;
  currentRole?: string;
  jobTitles?: string[];
  experienceYears?: number | null;
  locations?: string[];
  workModes?: string[];
  willingToRelocate?: boolean;
  requiredSkills?: string[];
  preferredSkills?: string[];
  industries?: string[];
  employmentTypes?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  currentSalary?: number | null;
  noticePeriodDays?: number | null;
  visaSponsorshipRequired?: boolean;
  workAuthorization?: string;
  travelWillingness?: string;
  targetCompanies?: string[];
  excludedCompanies?: string[];
  matchThreshold?: number;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  autoSubmitEnabled?: boolean;
  requireReview?: boolean;
  searchFrequencyHours?: number;
  resumeText?: string;
  resumeParsed?: {
    skills?: string[];
    experienceYears?: number | null;
    jobTitles?: string[];
  };
  resumeAccepted?: boolean;
  resumeSkipped?: boolean;
  hiringGoal?: string;
  companyName?: string;
  companySize?: string;
  rolesHired?: string[];
  hiringVolume?: string;
  teamMembers?: number | null;
}

export function computeCompletionPct(
  persona: UserPersona,
  draft: OnboardingDraft,
  hasResume: boolean
): number {
  if (persona === "EXPLORER") return draft.persona ? 100 : 20;

  if (persona !== "JOB_SEEKER") {
    let score = 0;
    if (draft.persona) score += 25;
    if (draft.companyName) score += 25;
    if (draft.hiringGoal) score += 25;
    if (draft.rolesHired?.length) score += 25;
    return Math.min(100, score);
  }

  const weights: { check: boolean; weight: number }[] = [
    { check: Boolean(draft.persona), weight: 8 },
    { check: Boolean(draft.fullName && draft.currentLocation), weight: 10 },
    { check: Boolean(draft.jobTitles?.length && draft.experienceYears != null), weight: 14 },
    { check: Boolean(draft.locations?.length || draft.workModes?.includes("REMOTE")), weight: 12 },
    { check: Boolean(draft.requiredSkills?.length), weight: 12 },
    { check: Boolean(draft.salaryMin != null || draft.salaryMax != null), weight: 8 },
    { check: Boolean(draft.matchThreshold != null), weight: 6 },
    { check: hasResume || Boolean(draft.resumeText) || Boolean(draft.resumeSkipped), weight: 20 },
    { check: draft.requireReview != null || draft.autoSubmitEnabled != null, weight: 10 },
  ];

  const total = weights.reduce((s, w) => s + w.weight, 0);
  const earned = weights.reduce((s, w) => s + (w.check ? w.weight : 0), 0);
  return Math.round((earned / total) * 100);
}
