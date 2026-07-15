import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { prepareApplicationSubmission } from "@/lib/agent/orchestrator";
import { validateSubmissionAuthorization } from "@/lib/applications/action-policy";
import { EntitlementError } from "@/lib/entitlements";

const actionSchema = z.object({
  autoSubmit: z.boolean().default(false),
  confirmed: z.boolean().default(false),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const application = await prisma.application.findFirst({
      where: { id, userId: user.id },
      include: {
        job: true,
        tailoredResume: true,
        coverLetter: true,
      },
    });
    if (!application) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
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
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.application);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid application action." },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const ownedApplication = await prisma.application.findFirst({
      where: { id, userId: user.id },
      select: { id: true, job: { select: { status: true } } },
    });
    if (!ownedApplication) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (["EXPIRED", "CLOSED"].includes(ownedApplication.job.status)) {
      return NextResponse.json(
        {
          error:
            "This posting is expired or closed. It cannot be prepared or submitted.",
          code: "JOB_NOT_ACTIVE",
        },
        { status: 409 }
      );
    }
    const authorization = validateSubmissionAuthorization(body);
    if (!authorization.allowed) {
      return NextResponse.json(
        {
          error: authorization.message,
          code: authorization.code,
        },
        { status: 409 }
      );
    }
    const result = await prepareApplicationSubmission(user.id, id, {
      autoSubmit: body.autoSubmit,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          feature: error.feature,
          remaining: error.remaining,
        },
        { status: 402 }
      );
    }
    const message = error instanceof Error ? error.message : "Submit failed";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Unauthorized"
            ? 401
            : message === "Application not found"
              ? 404
              : message.includes("Generate tailored")
                ? 422
                : 500,
      }
    );
  }
}
