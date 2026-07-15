import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

const restoreSchema = z.object({ versionId: z.string().uuid() });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const resume = await prisma.tailoredResume.findFirst({
      where: { id, userId: user.id },
      select: { id: true, version: true },
    });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const versions = await prisma.tailoredResumeVersion.findMany({
      where: { tailoredResumeId: id, userId: user.id },
      orderBy: { version: "desc" },
    });
    return NextResponse.json({ currentVersion: resume.version, versions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const parsed = restoreSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid version" }, { status: 400 });
    }

    const restored = await prisma.$transaction(async (tx) => {
      const [current, selected] = await Promise.all([
        tx.tailoredResume.findFirst({ where: { id, userId: user.id } }),
        tx.tailoredResumeVersion.findFirst({
          where: {
            id: parsed.data.versionId,
            tailoredResumeId: id,
            userId: user.id,
          },
        }),
      ]);
      if (!current || !selected) throw new Error("Resume version not found");

      await tx.tailoredResumeVersion.upsert({
        where: {
          tailoredResumeId_version: {
            tailoredResumeId: current.id,
            version: current.version,
          },
        },
        create: {
          tailoredResumeId: current.id,
          userId: user.id,
          version: current.version,
          title: current.title,
          content: current.content as Prisma.InputJsonValue,
          rawText: current.rawText,
          highlights: current.highlights,
          sourceMasterVersion: current.sourceMasterVersion,
          sourceMasterTitle: current.sourceMasterTitle,
          sourceMasterSnapshot:
            current.sourceMasterSnapshot as Prisma.InputJsonValue,
          groundingReport: current.groundingReport as Prisma.InputJsonValue,
        },
        update: {},
      });

      return tx.tailoredResume.update({
        where: { id: current.id },
        data: {
          title: selected.title,
          content: selected.content as Prisma.InputJsonValue,
          rawText: selected.rawText,
          highlights: selected.highlights,
          sourceMasterVersion: selected.sourceMasterVersion,
          sourceMasterTitle: selected.sourceMasterTitle,
          sourceMasterSnapshot:
            selected.sourceMasterSnapshot as Prisma.InputJsonValue,
          groundingReport: selected.groundingReport as Prisma.InputJsonValue,
          version: { increment: 1 },
          archivedAt: null,
          fileUrl: null,
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "TAILORED_RESUME_VERSION_RESTORED",
      resource: "tailored_resume",
      resourceId: id,
      message: `Restored tailored resume as version ${restored.version}`,
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
