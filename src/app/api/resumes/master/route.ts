import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import {
  parseResumeFile,
  parseResumeStructure,
} from "@/lib/resumes/parser";
import type { Prisma } from "@prisma/client";

const resumeSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Master Resume"),
  rawText: z.string().trim().min(80).max(200_000),
});

export async function GET() {
  try {
    const user = await resolveApiUser();
    const resume = await prisma.masterResume.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json(resume);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    let title = "Master Resume";
    let parsedResume;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const submittedTitle = form.get("title");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Choose a PDF, DOCX, or text resume." },
          { status: 400 }
        );
      }
      if (typeof submittedTitle === "string" && submittedTitle.trim()) {
        title = submittedTitle.trim().slice(0, 120);
      }
      parsedResume = await parseResumeFile({
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } else {
      const parsed = resumeSchema.safeParse(await request.json());
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ??
              "Resume content must contain at least 80 characters.",
          },
          { status: 400 }
        );
      }
      title = parsed.data.title;
      parsedResume = parseResumeStructure(parsed.data.rawText, {
        mediaType: "text/plain",
        parser: "manual",
      });
    }
    const { rawText, skills, content } = parsedResume;

    const resume = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterResume.findUnique({
        where: { userId: user.id },
      });
      if (!existing) {
        return tx.masterResume.create({
          data: {
            userId: user.id,
            title,
            content,
            rawText,
            skills,
            version: 1,
          },
        });
      }

      await tx.masterResumeVersion.create({
        data: {
          masterResumeId: existing.id,
          userId: user.id,
          version: existing.version,
          title: existing.title,
          content: existing.content as Prisma.InputJsonValue,
          rawText: existing.rawText,
          skills: existing.skills,
        },
      });
      return tx.masterResume.update({
        where: { id: existing.id },
        data: {
          title,
          content,
          rawText,
          skills,
          version: { increment: 1 },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "RESUME_UPLOADED",
      resource: "master_resume",
      resourceId: resume.id,
      message: `Master resume updated with ${skills.length} skills detected`,
      level: "AUDIT",
    });

    return NextResponse.json(resume);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message === "Unauthorized"
        ? 401
        : /upload|empty|mb or smaller|enough readable text|scanned pdfs|choose a pdf/i.test(
              message
            )
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const result = await prisma.masterResume.deleteMany({
      where: { userId: user.id },
    });
    if (result.count > 0) {
      await createAuditLog({
        userId: user.id,
        action: "RESUME_DELETED",
        resource: "master_resume",
        message: "Master resume deleted by user",
        level: "AUDIT",
      });
    }
    return NextResponse.json({ deleted: result.count > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
