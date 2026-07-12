import { getDbUser } from "@/lib/auth/server";

const ADMIN_EMAILS = (process.env.KAIRELA_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function isAdminUser(): Promise<boolean> {
  if (ADMIN_EMAILS.length === 0) return false;
  const user = await getDbUser();
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export function requireAdminEmails(): string[] {
  return ADMIN_EMAILS;
}
