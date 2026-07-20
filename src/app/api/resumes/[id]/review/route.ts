import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createAuditLog, prisma, resolveApiUser } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import {
  applySafeFixAction,
  ensureSafeFixReview,
  type ReviewableGroundingReport,
} from "@/lib/resumes/safe-fix-review";

const actionSchema = z.object({
  action: z.enum([
    "ACCEPT",
    "REJECT",
    "ACCEPT_ALL_SAFE",
    "REJECT_ALL",
    "UNDO_LAST",
    "UNDO_ALL",
  ]),
  fixId: z.string().min(1).optional(),
  confirmed: z.boolean().optional(),
});

async function ownedResume(id: string, userId: string) {
  return prisma.tailoredResume.findFirst({
    where: { id, userId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const resume = await ownedResume(id, user.id);
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const existingReport =
      (resume.groundingReport ?? {}) as ReviewableGroundingReport;
    const report = ensureSafeFixReview(
      existingReport,
      {
        resumeId: resume.id,
        resumeVersion: resume.version,
        userId: user.id,
        rawText: resume.rawText,
      }
    );
    if (!existingReport.safeFixReview && report.safeFixReview) {
      await prisma.tailoredResume.update({
        where: { id: resume.id },
        data: { groundingReport: report as Prisma.InputJsonValue },
      });
    }
    return NextResponse.json({
      review: report.safeFixReview,
      resumeVersion: resume.version,
    });
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
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a valid review action" },
        { status: 400 }
      );
    }
    if (
      (parsed.data.action === "ACCEPT" ||
        parsed.data.action === "REJECT") &&
      !parsed.data.fixId
    ) {
      return NextResponse.json(
        { error: "Choose a fix to review" },
        { status: 400 }
      );
    }

    const current = await ownedResume(id, user.id);
    if (!current) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const initialized = ensureSafeFixReview(
      (current.groundingReport ?? {}) as ReviewableGroundingReport,
      {
        resumeId: current.id,
        resumeVersion: current.version,
        userId: user.id,
        rawText: current.rawText,
      }
    );
    const result = applySafeFixAction({
      report: initialized,
      rawText: current.rawText,
      content: current.content,
      action: parsed.data.action,
      fixId: parsed.data.fixId,
      userId: user.id,
      confirmed: parsed.data.confirmed,
    });

    if (
      result.report === initialized &&
      !result.changedContent
    ) {
      return NextResponse.json({
        review: initialized.safeFixReview,
        resumeVersion: current.version,
        unchanged: true,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (result.changedContent) {
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
            groundingReport:
              current.groundingReport as Prisma.InputJsonValue,
          },
          update: {},
        });
      }

      return tx.tailoredResume.update({
        where: { id: current.id },
        data: {
          content: result.content as Prisma.InputJsonValue,
          rawText: result.rawText,
          groundingReport: result.report as Prisma.InputJsonValue,
          ...(result.changedContent
            ? { version: { increment: 1 }, fileUrl: null }
            : {}),
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: `ATS_SAFE_FIX_${parsed.data.action}`,
      resource: "tailored_resume",
      resourceId: current.id,
      message: `ATS safe-fix action ${parsed.data.action.toLowerCase()} completed`,
      level: "AUDIT",
      metadata: {
        fixId: parsed.data.fixId ?? null,
        changedContent: result.changedContent,
        resultingVersion: updated.version,
      },
    });
    return NextResponse.json({
      review: result.report.safeFixReview,
      resumeVersion: updated.version,
      changedContent: result.changedContent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("requires explicit") ||
            message.includes("no longer current")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
