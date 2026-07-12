import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import prisma from "@/lib/db";
import { getOrCreateUser } from "@/lib/jobs/pipeline";
import { createAuditLog } from "@/lib/audit";

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

export async function POST(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string;
    if (user) {
      const dbUser = await getOrCreateUser(user.id, user.email!);
      userId = dbUser.id;
    } else if (process.env.NODE_ENV === "development") {
      const dbUser = await getOrCreateUser("dev-user", "dev@localhost");
      userId = dbUser.id;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, rawText } = await request.json();
    if (!rawText?.trim()) {
      return NextResponse.json(
        { error: "Resume content is required" },
        { status: 400 }
      );
    }

    const skills = extractSkills(rawText);

    const resume = await prisma.masterResume.upsert({
      where: { userId },
      create: {
        userId,
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
      userId,
      action: "RESUME_UPLOADED",
      resource: "master_resume",
      resourceId: resume.id,
      message: `Master resume updated with ${skills.length} skills detected`,
      level: "AUDIT",
    });

    return NextResponse.json(resume);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
