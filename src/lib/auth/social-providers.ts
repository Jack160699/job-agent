import { FEATURE_FLAGS } from "@/lib/feature-flags";

export type SocialProviderId = "google" | "linkedin_oidc";

export interface SocialProviderConfig {
  id: SocialProviderId;
  label: string;
  connectingLabel: string;
  /** Whether this provider should currently be offered on auth pages. */
  enabled: boolean;
}

export const SOCIAL_PROVIDERS: Record<SocialProviderId, SocialProviderConfig> = {
  google: {
    id: "google",
    label: "Continue with Google",
    connectingLabel: "Connecting…",
    enabled: true,
  },
  linkedin_oidc: {
    id: "linkedin_oidc",
    label: "Continue with LinkedIn",
    connectingLabel: "Connecting…",
    enabled: FEATURE_FLAGS.linkedinAuth,
  },
};

export function isSocialProviderId(value: string): value is SocialProviderId {
  return value === "google" || value === "linkedin_oidc";
}
