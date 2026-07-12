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

export async function resolveApiUserDev() {
  try {
    return await resolveApiUser();
  } catch {
    if (process.env.NODE_ENV === "development") {
      const { getOrCreateUser } = await import("@/lib/jobs/pipeline");
      return getOrCreateUser("dev-user", "dev@localhost");
    }
    throw new Error("Unauthorized");
  }
}

export { createAuditLog, prisma };
