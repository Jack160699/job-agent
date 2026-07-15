import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { tailoredResumeDeletionPolicy } from "@/lib/resumes/history-policy";

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    title: z.string().trim().min(1).max(120),
  }),
  z.object({ action: z.enum(["archive", "unarchive"]) }),
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const resume = await prisma.tailoredResume.findFirst({
      where: { id, userId: user.id },
      include: {
        job: { select: { id: true, title: true, company: true } },
        application: { select: { id: true, status: true } },
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    return NextResponse.json({ resume });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid resume action" }, { status: 400 });
    }
    const owned = await prisma.tailoredResume.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const resume = await prisma.tailoredResume.update({
      where: { id },
      data:
        parsed.data.action === "rename"
          ? { title: parsed.data.title }
          : {
              archivedAt:
                parsed.data.action === "archive" ? new Date() : null,
            },
    });
    await createAuditLog({
      userId: user.id,
      action: `TAILORED_RESUME_${parsed.data.action.toUpperCase()}`,
      resource: "tailored_resume",
      resourceId: id,
      message: `Tailored resume ${parsed.data.action} completed`,
      level: "AUDIT",
    });
    return NextResponse.json({ resume });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const resume = await prisma.tailoredResume.findFirst({
      where: { id, userId: user.id },
      include: { application: { select: { id: true, status: true } } },
    });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const policy = tailoredResumeDeletionPolicy(resume.application?.status);
    if (!policy.allowed) {
      return NextResponse.json(
        {
          error: policy.message,
          code: policy.code,
        },
        { status: 409 }
      );
    }
    await prisma.tailoredResume.delete({ where: { id } });
    await createAuditLog({
      userId: user.id,
      action: "TAILORED_RESUME_DELETED",
      resource: "tailored_resume",
      resourceId: id,
      message: "Tailored resume deleted by owner",
      level: "AUDIT",
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
