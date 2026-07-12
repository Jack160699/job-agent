import prisma from "@/lib/db";
import type { SearchProgressStage } from "./preferences";
import { stageToPercent } from "./preferences";
import type { Prisma } from "@prisma/client";

export async function updateJobProgress(
  jobId: string,
  stage: SearchProgressStage,
  meta?: Record<string, unknown>
) {
  const now = new Date();
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      heartbeatAt: now,
      progressStage: stage,
      progressPercent: stageToPercent(stage),
      progressMeta: meta as Prisma.InputJsonValue | undefined,
    },
  });
}
