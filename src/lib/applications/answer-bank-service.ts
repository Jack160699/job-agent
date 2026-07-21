import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export type AnswerUsageCreditResult = {
  answerBankId: string;
  fieldKey: string;
  inserted: boolean;
  alreadyRecorded: boolean;
  currentUsageCount: number;
  usageRecordId: string | null;
};

export type AnswerUsageCreditSummary = {
  provisioned: string[];
  inserted: AnswerUsageCreditResult[];
  alreadyPresent: AnswerUsageCreditResult[];
  currentUsageCounts: Record<string, number>;
};

type CreditRow = {
  inserted: boolean;
  already_recorded: boolean;
  current_usage_count: number;
  usage_record_id: string | null;
};

function emptySummary(provisioned: string[] = []): AnswerUsageCreditSummary {
  return {
    provisioned,
    inserted: [],
    alreadyPresent: [],
    currentUsageCounts: {},
  };
}

function summarize(
  provisioned: string[],
  results: AnswerUsageCreditResult[]
): AnswerUsageCreditSummary {
  return {
    provisioned,
    inserted: results.filter((result) => result.inserted),
    alreadyPresent: results.filter((result) => result.alreadyRecorded),
    currentUsageCounts: Object.fromEntries(
      results.map((result) => [result.fieldKey, result.currentUsageCount])
    ),
  };
}

/**
 * Authoritative, idempotent usage credit for one confirmed answer on one application.
 * Uniqueness is (applicationId, answerBankId). Concurrent queue + worker callbacks are safe.
 */
export async function creditApplicationAnswerUsage(input: {
  userId: string;
  applicationId: string;
  answerBankId: string;
  fieldKey?: string;
  source?: string;
}): Promise<AnswerUsageCreditResult> {
  const answer = await prisma.applicationAnswerBank.findFirst({
    where: {
      id: input.answerBankId,
      userId: input.userId,
    },
    select: {
      id: true,
      questionKey: true,
      confirmationState: true,
      usageCount: true,
    },
  });
  if (!answer) {
    throw new Error("ANSWER_NOT_OWNED_OR_MISSING");
  }
  if (
    input.fieldKey &&
    answer.questionKey !== input.fieldKey
  ) {
    throw new Error("ANSWER_FIELD_MISMATCH");
  }
  if (answer.confirmationState !== "confirmed") {
    throw new Error("ANSWER_NOT_CONFIRMED");
  }

  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, userId: input.userId },
    select: { id: true },
  });
  if (!application) {
    throw new Error("APPLICATION_NOT_OWNED");
  }

  try {
    const rows = await prisma.$queryRaw<CreditRow[]>`
      SELECT *
      FROM public.credit_application_answer_usage(
        ${input.userId}::uuid,
        ${input.applicationId}::uuid,
        ${input.answerBankId}::uuid,
        ${input.fieldKey ?? null}::text,
        ${input.source ?? "preparation"}::text
      )
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("CREDIT_RPC_EMPTY");
    }
    return {
      answerBankId: answer.id,
      fieldKey: answer.questionKey,
      inserted: Boolean(row.inserted),
      alreadyRecorded: Boolean(row.already_recorded),
      currentUsageCount: Number(row.current_usage_count),
      usageRecordId: row.usage_record_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("credit_application_answer_usage") &&
      (message.includes("does not exist") || message.includes("function public.credit"))
    ) {
      return creditApplicationAnswerUsageFallback(input, answer);
    }
    throw error;
  }
}

async function creditApplicationAnswerUsageFallback(
  input: {
    userId: string;
    applicationId: string;
    answerBankId: string;
    fieldKey?: string;
    source?: string;
  },
  answer: {
    id: string;
    questionKey: string;
    confirmationState: string;
    usageCount: number;
  }
): Promise<AnswerUsageCreditResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.applicationAnswerUsage.findFirst({
      where: {
        userId: input.userId,
        applicationId: input.applicationId,
        answerBankId: answer.id,
      },
      select: { id: true },
    });
    if (existing) {
      const current = await tx.applicationAnswerBank.findFirst({
        where: { id: answer.id, userId: input.userId },
        select: { usageCount: true },
      });
      return {
        answerBankId: answer.id,
        fieldKey: answer.questionKey,
        inserted: false,
        alreadyRecorded: true,
        currentUsageCount: current?.usageCount ?? answer.usageCount,
        usageRecordId: existing.id,
      };
    }

    const full = await tx.applicationAnswerBank.findFirstOrThrow({
      where: { id: answer.id, userId: input.userId },
    });
    try {
      const created = await tx.applicationAnswerUsage.create({
        data: {
          userId: input.userId,
          answerBankId: answer.id,
          applicationId: input.applicationId,
          answerSnapshot: full.answer as Prisma.InputJsonValue,
        },
      });
      const updated = await tx.applicationAnswerBank.update({
        where: { id: answer.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
        select: { usageCount: true },
      });
      return {
        answerBankId: answer.id,
        fieldKey: answer.questionKey,
        inserted: true,
        alreadyRecorded: false,
        currentUsageCount: updated.usageCount,
        usageRecordId: created.id,
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "P2002") throw error;
      const raced = await tx.applicationAnswerUsage.findFirst({
        where: {
          userId: input.userId,
          applicationId: input.applicationId,
          answerBankId: answer.id,
        },
        select: { id: true },
      });
      const current = await tx.applicationAnswerBank.findFirst({
        where: { id: answer.id, userId: input.userId },
        select: { usageCount: true },
      });
      return {
        answerBankId: answer.id,
        fieldKey: answer.questionKey,
        inserted: false,
        alreadyRecorded: true,
        currentUsageCount: current?.usageCount ?? answer.usageCount,
        usageRecordId: raced?.id ?? null,
      };
    }
  });
}

/**
 * Credit every confirmed answer that was provisioned for preparation.
 * Safe to call from queue enqueue, direct prepare success, and worker callbacks.
 */
export async function creditProvisionedAnswerUsage(
  userId: string,
  applicationId: string,
  fieldKeys: string[],
  source = "preparation"
): Promise<AnswerUsageCreditSummary> {
  const keys = [...new Set(fieldKeys.filter(Boolean))];
  if (keys.length === 0) return emptySummary();

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) return emptySummary(keys);

  const answers = await prisma.applicationAnswerBank.findMany({
    where: {
      userId,
      questionKey: { in: keys },
      confirmationState: "confirmed",
    },
    select: { id: true, questionKey: true },
  });
  if (answers.length === 0) return emptySummary(keys);

  const results: AnswerUsageCreditResult[] = [];
  for (const answer of answers) {
    try {
      results.push(
        await creditApplicationAnswerUsage({
          userId,
          applicationId,
          answerBankId: answer.id,
          fieldKey: answer.questionKey,
          source,
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "USER_DELETED" || message.includes("USER_DELETED")) {
        break;
      }
      if (
        message === "ANSWER_NOT_OWNED_OR_MISSING" ||
        message === "ANSWER_NOT_CONFIRMED" ||
        message.includes("ANSWER_NOT_OWNED") ||
        message.includes("ANSWER_NOT_CONFIRMED")
      ) {
        continue;
      }
      throw error;
    }
  }

  return summarize(
    answers.map((answer) => answer.questionKey),
    results
  );
}

export async function revokeApplicationAnswerUsage(
  userId: string,
  applicationId: string
): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ revoke_application_answer_usage: number }>>`
      SELECT public.revoke_application_answer_usage(
        ${userId}::uuid,
        ${applicationId}::uuid
      )
    `;
    return Number(rows[0]?.revoke_application_answer_usage ?? 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("revoke_application_answer_usage") &&
      (message.includes("does not exist") || message.includes("function public.revoke"))
    ) {
      return revokeApplicationAnswerUsageFallback(userId, applicationId);
    }
    throw error;
  }
}

async function revokeApplicationAnswerUsageFallback(
  userId: string,
  applicationId: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const usages = await tx.applicationAnswerUsage.findMany({
      where: { userId, applicationId },
      select: { id: true, answerBankId: true },
    });
    if (usages.length === 0) return 0;
    await tx.applicationAnswerUsage.deleteMany({
      where: { id: { in: usages.map((usage) => usage.id) } },
    });
    for (const usage of usages) {
      await tx.applicationAnswerBank.updateMany({
        where: { id: usage.answerBankId, userId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
    return usages.length;
  });
}

/** @deprecated Prefer creditProvisionedAnswerUsage — kept for call-site compatibility. */
export async function recordAnswerBankUsage(
  userId: string,
  applicationId: string,
  answeredKeys: string[]
) {
  const summary = await creditProvisionedAnswerUsage(
    userId,
    applicationId,
    answeredKeys,
    "legacy_record"
  );
  return summary.inserted.length;
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

export function isConfirmedRelevantClassification(
  classification: string | null | undefined
): boolean {
  return (
    classification === "STRONG" ||
    classification === "POSSIBLE" ||
    classification === "LOW" ||
    classification === "CONFIRMED_RELEVANT"
  );
}

export function isPotentialMatchClassification(
  classification: string | null | undefined
): boolean {
  return classification === "POTENTIAL_MATCH_REQUIRES_VERIFICATION";
}
