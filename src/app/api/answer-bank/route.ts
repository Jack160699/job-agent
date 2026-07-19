import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveApiUser } from "@/lib/api/auth";
import {
  APPLICATION_ANSWER_DEFINITION_MAP,
  normalizeAnswerValue,
} from "@/lib/applications/answer-bank";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const user = await resolveApiUser();
    const answers = await prisma.applicationAnswerBank.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    const answerIds = answers.map((answer) => answer.id);
    const [versions, usages] = await Promise.all([
      answerIds.length
        ? prisma.applicationAnswerVersion.findMany({
            where: { userId: user.id, answerBankId: { in: answerIds } },
            orderBy: [{ answerBankId: "asc" }, { version: "desc" }],
          })
        : [],
      answerIds.length
        ? prisma.applicationAnswerUsage.findMany({
            where: { userId: user.id, answerBankId: { in: answerIds } },
            orderBy: { usedAt: "desc" },
            take: 100,
          })
        : [],
    ]);
    const applicationIds = usages
      .map((usage) => usage.applicationId)
      .filter((id): id is string => Boolean(id));
    const applications = applicationIds.length
      ? await prisma.application.findMany({
          where: { userId: user.id, id: { in: applicationIds } },
          select: {
            id: true,
            job: { select: { title: true, company: true } },
          },
        })
      : [];
    const applicationById = new Map(
      applications.map((application) => [application.id, application])
    );

    return NextResponse.json({
      answers: answers.map((answer) => ({
        ...answer,
        versions: versions.filter(
          (version) => version.answerBankId === answer.id
        ),
        usages: usages
          .filter((usage) => usage.answerBankId === answer.id)
          .map((usage) => ({
            ...usage,
            application: usage.applicationId
              ? applicationById.get(usage.applicationId) ?? null
              : null,
          })),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load answers";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = (await request.json()) as {
      questionKey?: string;
      answer?: unknown;
      confirmed?: boolean;
      isPrivate?: boolean;
    };
    const definition = body.questionKey
      ? APPLICATION_ANSWER_DEFINITION_MAP.get(body.questionKey)
      : null;
    if (!definition) {
      return NextResponse.json(
        { error: "Unsupported answer field" },
        { status: 400 }
      );
    }
    const answer = normalizeAnswerValue(definition, body.answer);
    const confirmed = body.confirmed === true;
    const saved = await prisma.applicationAnswerBank.upsert({
      where: {
        userId_questionKey: {
          userId: user.id,
          questionKey: definition.key,
        },
      },
      create: {
        userId: user.id,
        questionKey: definition.key,
        questionLabel: definition.label,
        answer: answer as Prisma.InputJsonValue,
        isSensitive: definition.sensitive,
        isPrivate: definition.sensitive || body.isPrivate !== false,
        confirmationState: confirmed ? "confirmed" : "unconfirmed",
        confirmedAt: confirmed ? new Date() : null,
      },
      update: {
        questionLabel: definition.label,
        answer: answer as Prisma.InputJsonValue,
        isSensitive: definition.sensitive,
        isPrivate: definition.sensitive || body.isPrivate !== false,
        confirmationState: confirmed ? "confirmed" : "unconfirmed",
        confirmedAt: confirmed ? new Date() : null,
      },
    });
    return NextResponse.json({ answer: saved }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save answer";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}
