/**
 * Feature flags — env-based, safe defaults for unfinished surfaces.
 */
export const FEATURE_FLAGS = {
  employerMode: process.env.FEATURE_EMPLOYER_MODE === "true",
  recruiterMode: process.env.FEATURE_RECRUITER_MODE === "true",
  agencyMode: process.env.FEATURE_AGENCY_MODE === "true",
  billing: process.env.FEATURE_BILLING === "true",
  aiConsultant: process.env.FEATURE_AI_CONSULTANT !== "false",
  proactiveAssistant: process.env.FEATURE_PROACTIVE_ASSISTANT !== "false",
  /** Public (client-safe) flag — must stay NEXT_PUBLIC_ prefixed so it inlines into the browser bundle. */
  linkedinAuth: process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED === "true",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

export function hiringPersonaEnabled(persona: string): boolean {
  switch (persona) {
    case "EMPLOYER":
      return FEATURE_FLAGS.employerMode;
    case "RECRUITER":
      return FEATURE_FLAGS.recruiterMode;
    case "AGENCY":
      return FEATURE_FLAGS.agencyMode;
    default:
      return true;
  }
}
