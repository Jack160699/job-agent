import prisma from "@/lib/db";
import type { LogLevel, Prisma } from "@prisma/client";

interface AuditLogParams {
  userId?: string;
  level?: LogLevel;
  action: string;
  resource?: string;
  resourceId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        level: params.level ?? "INFO",
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        message: params.message,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function getRecentLogs(userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
