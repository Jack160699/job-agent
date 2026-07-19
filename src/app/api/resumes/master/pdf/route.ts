import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import {
  isResumeLength,
  isResumeTemplateId,
} from "@/lib/resumes/templates";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;
  try {
    const user = await resolveApiUser();
    const versionId = request.nextUrl.searchParams.get("versionId");
    const requestedTemplate = request.nextUrl.searchParams.get("template");
    const requestedLength = request.nextUrl.searchParams.get("length");
    const preview = request.nextUrl.searchParams.get("preview") === "1";
    if (requestedTemplate && !isResumeTemplateId(requestedTemplate)) {
      return NextResponse.json({ error: "Unknown resume template" }, { status: 400 });
    }
    if (requestedLength && !isResumeLength(requestedLength)) {
      return NextResponse.json({ error: "Unknown resume length" }, { status: 400 });
    }
    const resume = versionId
      ? await prisma.masterResumeVersion.findFirst({
          where: { id: versionId, userId: user.id },
        })
      : await prisma.masterResume.findUnique({ where: { userId: user.id } });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const profile =
      (resume.content as { profile?: ParsedCareerProfile } | null)?.profile ?? null;
    const template =
      requestedTemplate && isResumeTemplateId(requestedTemplate)
        ? requestedTemplate
        : "ats-classic";
    const length =
      requestedLength && isResumeLength(requestedLength)
        ? requestedLength
        : "two-page";
    const pdf = await generateResumePdf({
      title: resume.title,
      rawText: resume.rawText,
      skills: resume.skills,
      profile,
      template,
      length,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="master-resume-v${resume.version}-${template}-${length}.pdf"`,
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
