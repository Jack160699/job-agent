import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";

const resumeSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Master Resume"),
  rawText: z.string().trim().min(80).max(200_000),
});

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
    const user = await resolveApiUser();
    const resume = await prisma.masterResume.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json(resume);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = resumeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Resume content must contain at least 80 characters.",
        },
        { status: 400 }
      );
    }
    const { title, rawText } = parsed.data;

    const skills = extractSkills(rawText);

    const resume = await prisma.masterResume.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        title,
        content: { sections: [] },
        rawText,
        skills,
        version: 1,
      },
      update: {
        title,
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
