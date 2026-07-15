import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";
import {
  rateLimit,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const { id } = await params;
    const versionId = request.nextUrl.searchParams.get("versionId");
    const current = await prisma.tailoredResume.findFirst({
      where: { id, userId: user.id },
      include: { job: { select: { title: true, company: true } } },
    });
    if (!current) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const version = versionId
      ? await prisma.tailoredResumeVersion.findFirst({
          where: {
            id: versionId,
            tailoredResumeId: current.id,
            userId: user.id,
          },
        })
      : null;
    if (versionId && !version) {
      return NextResponse.json({ error: "Resume version not found" }, { status: 404 });
    }
    const resume = version ?? current;

    const pdf = await generateResumePdf({
      title: resume.title,
      rawText: resume.rawText,
      highlights: resume.highlights,
    });
    const safeName = `${current.job?.company ?? "Kairela"}-${current.job?.title ?? resume.title}`
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName || "tailored-resume"}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
