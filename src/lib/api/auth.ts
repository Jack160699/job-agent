import { getDbUser } from "@/lib/auth/server";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/db";

export async function resolveApiUser() {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export { createAuditLog, prisma };
