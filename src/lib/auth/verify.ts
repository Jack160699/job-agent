import type { User } from "@supabase/supabase-js";

/** OAuth providers (Google, etc.) verify email at the IdP — no separate confirmation needed. */
export function isUserEmailVerified(user: User): boolean {
  if (user.email_confirmed_at) return true;

  const provider = user.app_metadata?.provider as string | undefined;
  if (provider && provider !== "email") return true;

  return (user.identities ?? []).some((identity) => identity.provider !== "email");
}
