import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveApiUser } from "@/lib/api/auth";
import {
  APPLICATION_ANSWER_DEFINITION_MAP,
  normalizeAnswerValue,
} from "@/lib/applications/answer-bank";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const existing = await prisma.applicationAnswerBank.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    const definition = APPLICATION_ANSWER_DEFINITION_MAP.get(
      existing.questionKey
    );
    if (!definition) {
      return NextResponse.json(
        { error: "Unsupported answer field" },
        { status: 400 }
      );
    }
    const body = (await request.json()) as {
      answer?: unknown;
      confirmed?: boolean;
      isPrivate?: boolean;
    };
    const answer = normalizeAnswerValue(definition, body.answer);
    const confirmed = body.confirmed === true;
    const updated = await prisma.applicationAnswerBank.update({
      where: { id },
      data: {
        answer: answer as Prisma.InputJsonValue,
        isPrivate: definition.sensitive || body.isPrivate !== false,
        confirmationState: confirmed ? "confirmed" : "unconfirmed",
        confirmedAt: confirmed ? new Date() : null,
      },
    });
    return NextResponse.json({ answer: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update answer";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const deleted = await prisma.applicationAnswerBank.deleteMany({
      where: { id, userId: user.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete answer";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
