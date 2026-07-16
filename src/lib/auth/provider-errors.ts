import { isSocialProviderId, type SocialProviderId } from "./social-providers";

export type AuthErrorProvider = SocialProviderId | "email" | null;

/**
 * Turns an untrusted `provider` query-param string into a known provider id
 * or null. Never trust this value for anything beyond choosing which
 * user-facing copy to show — it is cosmetic only.
 */
export function sanitizeProviderParam(value: string | null | undefined): AuthErrorProvider {
  if (!value) return null;
  if (value === "email") return "email";
  if (isSocialProviderId(value)) return value;
  return null;
}

/** Safe, non-technical copy — never forwards a raw provider error description to the user. */
export function providerAuthFailedMessage(provider: AuthErrorProvider): string {
  if (provider === "google") return "Google authentication could not be completed.";
  if (provider === "linkedin_oidc") return "LinkedIn authentication could not be completed.";
  return "Authentication could not be completed.";
}

export type AuthErrorCategory =
  | "expired"
  | "invalid_grant"
  | "access_denied"
  | "network"
  | "unknown";

/**
 * Classifies a provider/Supabase error message into a coarse category for
 * logging — never logs the raw message, which may contain technical detail
 * (or, in principle, provider-supplied text) unsuitable for server logs.
 */
export function classifyAuthError(message: string | null | undefined): AuthErrorCategory {
  const lower = (message ?? "").toLowerCase();
  if (!lower) return "unknown";
  if (lower.includes("expire")) return "expired";
  if (lower.includes("denied") || lower.includes("cancel")) return "access_denied";
  if (lower.includes("grant") || lower.includes("invalid")) return "invalid_grant";
  if (lower.includes("network") || lower.includes("fetch")) return "network";
  return "unknown";
}
