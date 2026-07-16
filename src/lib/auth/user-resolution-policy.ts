/**
 * Pure decision logic for resolving an authenticated Supabase user to a
 * Prisma User, without duplicating accounts and without linking on an
 * unverified email. Kept free of any DB/Supabase SDK calls so the policy
 * itself is fully unit-testable — see resolve-user.ts for the orchestrator
 * that gathers these inputs and executes the resulting decision.
 */
export type UserResolutionDecision =
  | { action: "use_existing_by_id" }
  | { action: "email_missing" }
  | { action: "link_by_verified_email" }
  | { action: "unverified_email_conflict" }
  | { action: "create_new" };

export interface UserResolutionInput {
  /** A Prisma User already exists with supabaseId === the authenticated Supabase user id. */
  hasExistingBySupabaseId: boolean;
  /** The authenticated Supabase user has a non-empty email string. */
  hasUsableEmail: boolean;
  /** A Prisma User already exists with this email (under a different supabaseId). */
  existingByEmail: boolean;
  /** Supabase considers this email verified for the authenticated user. */
  emailVerified: boolean;
}

export function decideUserResolution(input: UserResolutionInput): UserResolutionDecision {
  if (input.hasExistingBySupabaseId) {
    return { action: "use_existing_by_id" };
  }

  if (!input.hasUsableEmail) {
    return { action: "email_missing" };
  }

  if (input.existingByEmail) {
    // Supabase auto-links identities sharing a verified email under one
    // auth.users row in the common case — reaching this branch with a
    // different supabaseId means that didn't happen, so only proceed if
    // this authentication itself carries a verified email. Never merge
    // two different Prisma users on an unverified claim.
    return input.emailVerified
      ? { action: "link_by_verified_email" }
      : { action: "unverified_email_conflict" };
  }

  return { action: "create_new" };
}
