import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveApiUserDev, prisma } from "@/lib/api/auth";
import { prepareApplicationSubmission } from "@/lib/agent/orchestrator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUserDev();
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const { id } = await params;
    const body = await request.json();
    const result = await prepareApplicationSubmission(user.id, id, {
      autoSubmit: body.autoSubmit === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
