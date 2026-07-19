import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export async function recordAnswerBankUsage(
  userId: string,
  applicationId: string,
  answeredKeys: string[]
) {
  const keys = [...new Set(answeredKeys)];
  if (keys.length === 0) return 0;

  const answers = await prisma.applicationAnswerBank.findMany({
    where: {
      userId,
      questionKey: { in: keys },
      confirmationState: "confirmed",
    },
  });
  if (answers.length === 0) return 0;

  await prisma.$transaction([
    ...answers.map((answer) =>
      prisma.applicationAnswerUsage.create({
        data: {
          userId,
          answerBankId: answer.id,
          applicationId,
          answerSnapshot: answer.answer as Prisma.InputJsonValue,
        },
      })
    ),
    ...answers.map((answer) =>
      prisma.applicationAnswerBank.update({
        where: { id: answer.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      })
    ),
  ]);
  return answers.length;
}

export function answerToText(answer: Prisma.JsonValue): string | undefined {
  if (
    typeof answer === "string" ||
    typeof answer === "number" ||
    typeof answer === "boolean"
  ) {
    return String(answer);
  }
  return undefined;
}
