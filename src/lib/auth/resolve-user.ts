import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User as PrismaUser } from "@prisma/client";
import prisma from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { decideUserResolution } from "./user-resolution-policy";
import { extractBasicProfile, mergeProfileFillOnly } from "./profile-bootstrap";

export type UserResolutionResult =
  | { status: "resolved"; user: PrismaUser; created: boolean }
  | { status: "email_missing" }
  | { status: "email_unverified_conflict" };

const DEFAULT_ENABLED_SOURCES = ["LINKEDIN", "INDEED", "GREENHOUSE", "LEVER", "ASHBY"] as const;

export function hasUsableEmail(user: SupabaseUser): boolean {
  return Boolean(user.email && user.email.trim());
}

/**
 * True when Supabase (or the identity's own raw OIDC claim) considers this
 * user's email verified. Never used to merge accounts on its own — see
 * user-resolution-policy.ts for how this feeds the linking decision.
 */
export function isSupabaseEmailVerified(user: SupabaseUser): boolean {
  if (user.email_confirmed_at) return true;
  return (user.identities ?? []).some(
    (identity) =>
      identity.identity_data?.email === user.email &&
      identity.identity_data?.email_verified === true
  );
}

/**
 * Resolves an authenticated Supabase user to a Prisma User following the
 * safe order: existing-by-id, existing-by-verified-email (linking), or
 * brand-new. Never creates a duplicate Prisma User for the same email, and
 * never links on an unverified email claim. Only fills empty
 * fullName/avatarUrl from provider metadata — never overwrites a
 * user-edited or resume-confirmed value.
 */
export async function resolveKairelaUser(authUser: SupabaseUser): Promise<UserResolutionResult> {
  const existingBySupabaseId = await prisma.user.findUnique({ where: { supabaseId: authUser.id } });

  const emailUsable = hasUsableEmail(authUser);
  const email = emailUsable ? authUser.email!.trim() : null;
  const existingByEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;

  const decision = decideUserResolution({
    hasExistingBySupabaseId: Boolean(existingBySupabaseId),
    hasUsableEmail: emailUsable,
    existingByEmail: Boolean(existingByEmail),
    emailVerified: isSupabaseEmailVerified(authUser),
  });

  const incomingProfile = extractBasicProfile(authUser.user_metadata);

  switch (decision.action) {
    case "use_existing_by_id": {
      const user = existingBySupabaseId!;
      const patch = mergeProfileFillOnly(user, incomingProfile);
      if (Object.keys(patch).length === 0) {
        return { status: "resolved", user, created: false };
      }
      const updated = await prisma.user.update({ where: { id: user.id }, data: patch });
      return { status: "resolved", user: updated, created: false };
    }

    case "email_missing":
      return { status: "email_missing" };

    case "unverified_email_conflict":
      return { status: "email_unverified_conflict" };

    case "link_by_verified_email": {
      const existing = existingByEmail!;
      const patch = mergeProfileFillOnly(existing, incomingProfile);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { supabaseId: authUser.id, ...patch },
      });
      await createAuditLog({
        userId: updated.id,
        action: "USER_IDENTITY_LINKED",
        resource: "user",
        message: "Existing account linked to a new verified sign-in method",
        level: "AUDIT",
      });
      return { status: "resolved", user: updated, created: false };
    }

    case "create_new": {
      const created = await prisma.user.create({
        data: {
          supabaseId: authUser.id,
          email: email!,
          fullName: incomingProfile.fullName ?? undefined,
          avatarUrl: incomingProfile.avatarUrl ?? undefined,
          settings: {
            create: {
              jobTitles: [],
              locations: [],
              enabledSources: [...DEFAULT_ENABLED_SOURCES],
            },
          },
        },
      });
      await createAuditLog({
        userId: created.id,
        action: "USER_CREATED",
        message: "New user registered",
        level: "AUDIT",
      });
      return { status: "resolved", user: created, created: true };
    }
  }
}
