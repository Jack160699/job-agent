import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";
import type { Prisma } from "@prisma/client";

const restoreSchema = z.object({ versionId: z.string().uuid() });

export async function GET() {
  try {
    const user = await resolveApiUser();
    const current = await prisma.masterResume.findUnique({
      where: { userId: user.id },
      select: { id: true, version: true, title: true, updatedAt: true },
    });
    if (!current) {
      return NextResponse.json({ current: null, versions: [] });
    }
    const versions = await prisma.masterResumeVersion.findMany({
      where: { userId: user.id, masterResumeId: current.id },
      orderBy: { version: "desc" },
      take: 20,
      select: {
        id: true,
        version: true,
        title: true,
        createdAt: true,
        rawText: true,
      },
    });
    return NextResponse.json({
      current,
      versions: versions.map((version) => ({
        ...version,
        rawText: version.rawText.slice(0, 240),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = restoreSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid resume version." },
        { status: 400 }
      );
    }

    const restored = await prisma.$transaction(async (tx) => {
      const [current, selected] = await Promise.all([
        tx.masterResume.findUnique({ where: { userId: user.id } }),
        tx.masterResumeVersion.findFirst({
          where: { id: parsed.data.versionId, userId: user.id },
        }),
      ]);
      if (!current || !selected || selected.masterResumeId !== current.id) {
        throw new Error("Resume version not found");
      }
      await tx.masterResumeVersion.create({
        data: {
          masterResumeId: current.id,
          userId: user.id,
          version: current.version,
          title: current.title,
          content: current.content as Prisma.InputJsonValue,
          rawText: current.rawText,
          skills: current.skills,
        },
      });
      return tx.masterResume.update({
        where: { id: current.id },
        data: {
          title: selected.title,
          content: selected.content as Prisma.InputJsonValue,
          rawText: selected.rawText,
          skills: selected.skills,
          version: { increment: 1 },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "RESUME_VERSION_RESTORED",
      resource: "master_resume",
      resourceId: restored.id,
      message: `Restored master resume as version ${restored.version}`,
      level: "AUDIT",
    });
    return NextResponse.json({ resume: restored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Unauthorized"
            ? 401
            : message === "Resume version not found"
              ? 404
              : 500,
      }
    );
  }
}
