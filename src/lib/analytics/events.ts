export const ONBOARDING_ANALYTICS_EVENTS = [
  "onboarding_resume_screen_viewed",
  "onboarding_resume_upload_started",
  "onboarding_resume_upload_succeeded",
  "onboarding_resume_upload_failed",
  "onboarding_resume_skipped",
  "onboarding_resume_review_completed",
  "onboarding_preferences_completed",
  "onboarding_completed",
] as const;

export type OnboardingAnalyticsEvent = (typeof ONBOARDING_ANALYTICS_EVENTS)[number];

export const AUTH_ANALYTICS_EVENTS = [
  "linkedin_auth_started",
  "linkedin_auth_succeeded",
  "linkedin_auth_failed",
  "linkedin_email_completion_required",
  "linkedin_identity_linked",
  "linkedin_identity_unlinked",
] as const;

export type AuthAnalyticsEvent = (typeof AUTH_ANALYTICS_EVENTS)[number];

/**
 * Keys allowed in event metadata — deliberately non-identifying. Never add a
 * key that could carry an email, name, provider subject identifier, OAuth
 * code/token, or profile photo URL; see sanitizeAnalyticsMetadata below,
 * which also caps string length as a second guard.
 */
const ALLOWED_METADATA_KEYS = new Set([
  "fileType",
  "fileSizeBucket",
  "errorCategory",
  "durationMs",
  "skillsCount",
  "fieldsFilled",
  "fieldsNeedingReview",
  "hasResume",
  "step",
  "provider",
]);

export function sanitizeAnalyticsMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!metadata) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value === "string" && value.length > 60) continue; // guards against accidental PII/text dumps
    clean[key] = value;
  }
  return clean;
}

/** Client-side helper: fire-and-forget, never throws, never blocks the UI. */
export function trackOnboardingEvent(
  event: OnboardingAnalyticsEvent,
  metadata?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/analytics/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata: sanitizeAnalyticsMetadata(metadata) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the onboarding flow.
  }
}

/**
 * Client-side helper for auth/LinkedIn events. Works both signed-out
 * (e.g. linkedin_auth_started, fired before the OAuth redirect) and
 * signed-in — fire-and-forget, never throws, never blocks the auth flow.
 */
export function trackAuthEvent(
  event: AuthAnalyticsEvent,
  metadata?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/analytics/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata: sanitizeAnalyticsMetadata(metadata) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the auth flow.
  }
}
