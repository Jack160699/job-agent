import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { generateResumePdf } from "@/lib/pdf/resume-pdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await resolveApiUser();
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, userId: user.id },
      include: { tailoredResume: true, job: true },
    });
    if (!application) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resume = application.tailoredResume;
    const master = await prisma.masterResume.findUnique({ where: { userId: user.id } });
    const rawText = resume?.rawText || master?.rawText || "";

    const pdf = await generateResumePdf({
      title: resume?.title || `${application.job.title} Resume`,
      rawText,
      highlights: resume?.highlights,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-${application.job.company}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
