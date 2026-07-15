import { PrismaClient } from "@prisma/client";
import {
  isTerminalBrowserTask,
  staleTaskRecoveryStatus,
} from "../../src/lib/browser/queue-policy";

const prisma = new PrismaClient();

export type BrowserTaskType =
  | "PREPARE_APPLICATION"
  | "SUBMIT_APPLICATION"
  | "DISCOVER_JOBS"
  | "SCREENSHOT";

export type BrowserTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead_letter";

export interface EnqueueBrowserTaskInput {
  userId: string;
  applicationId?: string;
  type: BrowserTaskType;
  platform?: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export class BrowserQueueManager {
  async enqueue(input: EnqueueBrowserTaskInput) {
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
    try {
      return await prisma.browserTask.create({
        data: {
          userId: input.userId,
          applicationId: input.applicationId,
          type: input.type,
          platform: input.platform,
          payload: input.payload ?? {},
          maxAttempts: input.maxAttempts ?? 3,
          status: "pending",
          progress: 0,
        },
      });
    } catch (error) {
      if (
        input.applicationId &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return prisma.browserTask.findFirstOrThrow({
          where: {
            userId: input.userId,
            applicationId: input.applicationId,
            type: input.type,
            status: { in: ["pending", "running"] },
          },
          orderBy: { createdAt: "desc" },
        });
      }
      throw error;
    }
  }

  async claimNext(limit = 1) {
    const pending = await prisma.browserTask.findMany({
      where: {
        status: "pending",
        cancelledAt: null,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit * 3,
    });

    const tasks = pending.filter((t) => t.attempts < t.maxAttempts).slice(0, limit);

    const claimed = [];
    for (const task of tasks) {
      const updated = await prisma.browserTask.updateMany({
        where: { id: task.id, status: "pending" },
        data: {
          status: "running",
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (updated.count === 1) {
        claimed.push(
          await prisma.browserTask.findUniqueOrThrow({ where: { id: task.id } })
        );
      }
    }
    return claimed;
  }

  async updateProgress(
    taskId: string,
    progress: number,
    extra?: { screenshotPaths?: string[] }
  ) {
    return prisma.browserTask.update({
      where: { id: taskId },
      data: {
        progress: Math.min(100, Math.max(0, progress)),
        ...(extra?.screenshotPaths
          ? { screenshotPaths: { push: extra.screenshotPaths } }
          : {}),
      },
    });
  }

  async complete(taskId: string, result: Record<string, unknown>) {
    const updated = await prisma.browserTask.updateMany({
      where: { id: taskId, status: "running", cancelledAt: null },
      data: {
        status: "completed",
        progress: 100,
        result,
        completedAt: new Date(),
        error: null,
      },
    });
    return updated.count === 1
      ? prisma.browserTask.findUnique({ where: { id: taskId } })
      : null;
  }

  async fail(taskId: string, error: string, screenshotPaths?: string[]) {
    const task = await prisma.browserTask.findUnique({ where: { id: taskId } });
    if (!task) return null;
    if (isTerminalBrowserTask(task.status)) {
      return task;
    }

    const isDeadLetter = task.attempts >= task.maxAttempts;
    return prisma.browserTask.update({
      where: { id: taskId },
      data: {
        status: isDeadLetter ? "dead_letter" : "pending",
        error,
        progress: 0,
        scheduledAt: isDeadLetter
          ? task.scheduledAt
          : new Date(Date.now() + task.attempts * 60_000),
        ...(screenshotPaths
          ? { screenshotPaths: { push: screenshotPaths } }
          : {}),
      },
    });
  }

  async cancel(taskId: string, userId?: string) {
    return prisma.browserTask.updateMany({
      where: {
        id: taskId,
        status: { in: ["pending", "running"] },
        ...(userId ? { userId } : {}),
      },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
      },
    });
  }

  async getStatus(taskId: string) {
    return prisma.browserTask.findUnique({ where: { id: taskId } });
  }

  async listForUser(userId: string, limit = 20) {
    return prisma.browserTask.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async retryDeadLetter(taskId: string) {
    return prisma.browserTask.updateMany({
      where: { id: taskId, status: "dead_letter" },
      data: {
        status: "pending",
        attempts: 0,
        error: null,
        scheduledAt: new Date(),
      },
    });
  }

  async recoverStaleRunning(timeoutMs = 10 * 60_000) {
    const cutoff = new Date(Date.now() - timeoutMs);
    const stale = await prisma.browserTask.findMany({
      where: {
        status: "running",
        cancelledAt: null,
        startedAt: { lt: cutoff },
      },
      select: { id: true, attempts: true, maxAttempts: true },
    });
    for (const task of stale) {
      await prisma.browserTask.updateMany({
        where: { id: task.id, status: "running", cancelledAt: null },
        data: {
          status: staleTaskRecoveryStatus(task),
          error: "WORKER_TIMEOUT_RECOVERED",
          progress: 0,
          scheduledAt: new Date(),
          startedAt: null,
        },
      });
    }
    return stale.length;
  }
}

export const browserQueue = new BrowserQueueManager();
