import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type BrowserTaskType =
  | "PREPARE_APPLICATION"
  | "SUBMIT_APPLICATION"
  | "DISCOVER_JOBS"
  | "SCREENSHOT";

export async function enqueueBrowserTask(input: {
  userId: string;
  applicationId?: string;
  type: BrowserTaskType;
  platform?: string;
  payload?: Record<string, unknown>;
}) {
  if (input.applicationId) {
    const existing = await prisma.browserTask.findFirst({
      where: {
        userId: input.userId,
        applicationId: input.applicationId,
        type: input.type,
        status: { in: ["pending", "running"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
  }

  return prisma.browserTask.create({
    data: {
      userId: input.userId,
      applicationId: input.applicationId,
      type: input.type,
      platform: input.platform,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      status: "pending",
      progress: 0,
    },
  });
}

export async function getBrowserTask(taskId: string) {
  return prisma.browserTask.findUnique({ where: { id: taskId } });
}

export async function listBrowserTasks(userId: string, limit = 20) {
  return prisma.browserTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function cancelBrowserTask(taskId: string, userId: string) {
  return prisma.browserTask.updateMany({
    where: {
      id: taskId,
      userId,
      status: { in: ["pending", "running"] },
    },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  });
}

export function shouldUseBrowserQueue() {
  return Boolean(process.env.VERCEL) || Boolean(process.env.BROWSER_QUEUE_ENABLED);
}

export function isBrowserBridgeAvailable() {
  return Boolean(process.env.BROWSER_MCP_BRIDGE_URL);
}
