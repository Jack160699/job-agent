import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUserDev, createAuditLog, prisma } from "@/lib/api/auth";

function extractSkills(text: string): string[] {
  const commonSkills = [
    "JavaScript", "TypeScript", "Python", "React", "Node.js", "Next.js",
    "AWS", "Docker", "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Git",
    "Java", "Go", "Rust", "C++", "Machine Learning", "AI", "DevOps",
    "GraphQL", "REST", "Redis", "Terraform", "CI/CD", "Agile", "Scrum",
    "HTML", "CSS", "Tailwind", "Vue", "Angular", "Express", "FastAPI",
    "Django", "Flask", "Spring", "Microservices", "System Design",
  ];
  const lower = text.toLowerCase();
  return commonSkills.filter((s) => lower.includes(s.toLowerCase()));
}

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const resume = await prisma.masterResume.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json(resume);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const { title, rawText } = await request.json();

    if (!rawText?.trim()) {
      return NextResponse.json(
        { error: "Resume content is required" },
        { status: 400 }
      );
    }

    const skills = extractSkills(rawText);

    const resume = await prisma.masterResume.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        title: title || "Master Resume",
        content: { sections: [] },
        rawText,
        skills,
        version: 1,
      },
      update: {
        title: title || "Master Resume",
        rawText,
        skills,
        version: { increment: 1 },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "RESUME_UPLOADED",
      resource: "master_resume",
      resourceId: resume.id,
      message: `Master resume updated with ${skills.length} skills detected`,
      level: "AUDIT",
    });

    return NextResponse.json(resume);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
