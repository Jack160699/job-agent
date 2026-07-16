/**
 * Safe "fill only empty fields" profile bootstrap from provider metadata.
 * Deliberately narrow: only fullName and avatarUrl are ever produced, so
 * this module cannot — by construction — invent a role, location, skills,
 * employment/education history, or a LinkedIn profile URL. LinkedIn OIDC
 * does not return a public profile URL; one must never be guessed from the
 * subject identifier.
 */
export interface BasicProviderProfile {
  fullName: string | null;
  avatarUrl: string | null;
}

export interface ExistingProfileFields {
  fullName: string | null | undefined;
  avatarUrl: string | null | undefined;
}

/** Reads only the safe basic-profile claims Supabase normalizes into user_metadata. */
export function extractBasicProfile(
  userMetadata: Record<string, unknown> | null | undefined
): BasicProviderProfile {
  const meta = userMetadata ?? {};
  const nameCandidate =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const avatarCandidate =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  return {
    fullName: nameCandidate?.trim() || null,
    avatarUrl: avatarCandidate?.trim() || null,
  };
}

/**
 * Fill-only-if-empty merge. Never overwrites a user-edited or
 * resume-confirmed value — returns just the fields that are safe to patch.
 */
export function mergeProfileFillOnly(
  existing: ExistingProfileFields,
  incoming: BasicProviderProfile
): Partial<BasicProviderProfile> {
  const patch: Partial<BasicProviderProfile> = {};
  if (!existing.fullName?.trim() && incoming.fullName) {
    patch.fullName = incoming.fullName;
  }
  if (!existing.avatarUrl?.trim() && incoming.avatarUrl) {
    patch.avatarUrl = incoming.avatarUrl;
  }
  return patch;
}
