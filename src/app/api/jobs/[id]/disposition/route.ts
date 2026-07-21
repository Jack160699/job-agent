import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

const schema = z.object({
  action: z.enum([
    "save",
    "unsave",
    "exclude",
    "restore",
    "verify_eligibility",
  ]),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.application);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job action" }, { status: 400 });
    }
    const owned = await prisma.job.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true, matchAnalysis: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const action = parsed.data.action;
    if (action === "verify_eligibility") {
      const previous =
        owned.matchAnalysis &&
        typeof owned.matchAnalysis === "object" &&
        !Array.isArray(owned.matchAnalysis)
          ? (owned.matchAnalysis as Record<string, unknown>)
          : {};
      const job = await prisma.job.update({
        where: { id },
        data: {
          matchAnalysis: {
            ...previous,
            eligibilityVerified: true,
            eligibilityVerifiedAt: new Date().toISOString(),
            requiresVerification: false,
          } as Prisma.InputJsonValue,
        },
      });
      await createAuditLog({
        userId: user.id,
        action: "JOB_VERIFY_ELIGIBILITY",
        resource: "job",
        resourceId: id,
        message: "User verified eligibility for a potential match",
        level: "AUDIT",
      });
      return NextResponse.json({ job });
    }
    const job = await prisma.job.update({
      where: { id },
      data:
        action === "save"
          ? { savedAt: new Date() }
          : action === "unsave"
            ? { savedAt: null }
            : action === "exclude"
              ? { status: "ARCHIVED" }
              : {
                  status: owned.status === "EXPIRED" ? "EXPIRED" : "ACTIVE",
                },
    });
    await createAuditLog({
      userId: user.id,
      action: `JOB_${action.toUpperCase()}`,
      resource: "job",
      resourceId: id,
      message: `Job ${action} action completed`,
      level: "AUDIT",
    });
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
