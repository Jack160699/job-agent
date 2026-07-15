import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";

const feedbackSchema = z.object({
  relevant: z.boolean(),
  reason: z
    .enum([
      "good_match",
      "wrong_role",
      "wrong_location",
      "wrong_seniority",
      "wrong_salary",
      "wrong_work_mode",
      "wrong_industry",
      "duplicate",
      "expired",
      "not_interested",
      "misleading_posting",
      "company_not_preferred",
      "other",
    ])
    .nullable()
    .optional(),
  details: z.string().trim().max(1000).nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.default,
    keyPrefix: "job-feedback",
  });
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id: jobId } = await params;
    const parsed = feedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Select a valid feedback reason." },
        { status: 400 }
      );
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const feedback = await prisma.jobFeedback.upsert({
      where: { userId_jobId: { userId: user.id, jobId } },
      create: { userId: user.id, jobId, ...parsed.data },
      update: parsed.data,
    });
    if (!parsed.data.relevant && parsed.data.reason === "expired") {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: jobId },
          data: { status: "EXPIRED" },
        }),
        prisma.application.updateMany({
          where: {
            userId: user.id,
            jobId,
            status: {
              notIn: [
                "SUBMITTED",
                "INTERVIEWING",
                "OFFERED",
                "ACCEPTED",
                "REJECTED",
                "WITHDRAWN",
              ],
            },
          },
          data: { status: "EXPIRED", failureReason: "JOB_EXPIRED" },
        }),
      ]);
    } else if (
      !parsed.data.relevant &&
      (parsed.data.reason === "duplicate" ||
        parsed.data.reason === "misleading_posting")
    ) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "ARCHIVED" },
      });
    }
    await createAuditLog({
      userId: user.id,
      action: "JOB_FEEDBACK_UPDATED",
      resource: "job",
      resourceId: jobId,
      message: parsed.data.relevant
        ? "Job marked relevant"
        : `Job marked not relevant${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
      level: "INFO",
    });
    return NextResponse.json({ feedback });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feedback update failed";
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
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.default,
    keyPrefix: "job-feedback",
  });
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id: jobId } = await params;
    await prisma.jobFeedback.deleteMany({
      where: { userId: user.id, jobId },
    });
    await prisma.job.updateMany({
      where: { id: jobId, userId: user.id },
      data: { status: "ACTIVE" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feedback removal failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
