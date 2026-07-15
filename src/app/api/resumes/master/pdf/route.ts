import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const versionId = request.nextUrl.searchParams.get("versionId");
    const resume = versionId
      ? await prisma.masterResumeVersion.findFirst({
          where: { id: versionId, userId: user.id },
        })
      : await prisma.masterResume.findUnique({ where: { userId: user.id } });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const pdf = await generateResumePdf({
      title: resume.title,
      rawText: resume.rawText,
      skills: resume.skills,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="master-resume-v${resume.version}.pdf"`,
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
