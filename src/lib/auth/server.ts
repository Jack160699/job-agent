import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/db";
import { resolveKairelaUser } from "./resolve-user";

/**
 * React's cache() memoizes per request: the dashboard layout, page, and any
 * server actions on the same request all resolve the same Supabase/DB user
 * lookup once instead of repeating the round trips on every call site.
 */
export const getAuthUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

export const getDbUser = cache(async () => {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return null;

    const existingByIdentity = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { settings: true },
    });
    if (existingByIdentity) return existingByIdentity;

    // Not yet resolved to a Prisma user under this Supabase id (e.g. first
    // page load right after an OAuth callback race, or a legacy session).
    // Reuse the same safe resolution used by /auth/callback: never links on
    // an unverified email, never creates a duplicate for an existing email.
    // A brand-new user here (rather than at the callback) is unusual but
    // possible if the callback's own resolution failed transiently; give it
    // the same default preferences as before.
    const resolution = await resolveKairelaUser(authUser);
    if (resolution.status !== "resolved") return null;

    return prisma.user.findUnique({
      where: { id: resolution.user.id },
      include: { settings: true },
    });
  } catch (error) {
    console.error("getDbUser failed:", error);
    return null;
  }
});

export async function requireDbUser() {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
