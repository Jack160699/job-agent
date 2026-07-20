export interface IdentitySummary {
  provider: string;
}

export interface UnlinkDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * A user must always retain at least one usable sign-in method. Supabase's
 * own unlinkIdentity() call enforces this server-side too — this is the
 * client-side pre-check so the UI can disable the action and show a clear
 * reason before ever making the request.
 */
export function canUnlinkIdentity(
  identities: IdentitySummary[],
  target: IdentitySummary
): UnlinkDecision {
  if (!identities.some((identity) => identity.provider === target.provider)) {
    return {
      allowed: false,
      reason: "This sign-in method is no longer connected.",
    };
  }
  if (identities.length <= 1) {
    return {
      allowed: false,
      reason: "You need at least one other way to sign in before disconnecting this account.",
    };
  }
  return { allowed: true };
}
