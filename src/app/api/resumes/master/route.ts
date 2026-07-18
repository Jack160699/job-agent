import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import { parseResumeFile, parseResumeStructure } from "@/lib/resumes/parser";
import { extractCareerProfile, type ParsedCareerProfile } from "@/lib/resumes/career-profile";
import { calculateAtsReadinessScore, type AtsReadinessScore } from "@/lib/resumes/ats-score";
import { enqueueJob, claimAndProcessJob } from "@/lib/jobs/background";
import type { Prisma } from "@prisma/client";

type StoredContent = {
  sections: unknown;
  source: unknown;
  profile: ParsedCareerProfile;
  atsScore: AtsReadinessScore;
  enrichment: { status: "pending" | "complete" | "skipped" | "failed"; completedAt?: string };
};

const resumeSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Master Resume"),
  rawText: z.string().trim().min(80).max(200_000),
});

export async function GET() {
  try {
    const user = await resolveApiUser();
    const resume = await prisma.masterResume.findUnique({
      where: { userId: user.id },
    });
    const content = resume?.content as Partial<StoredContent> | undefined;
    return NextResponse.json(
      resume
        ? {
            ...resume,
            profile: content?.profile ?? null,
            atsScore: content?.atsScore ?? null,
            enrichmentPending: content?.enrichment?.status === "pending",
          }
        : null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    let title = "Master Resume";
    let parsedResume;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const submittedTitle = form.get("title");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Choose a PDF, DOCX, or text resume." },
          { status: 400 }
        );
      }
      if (typeof submittedTitle === "string" && submittedTitle.trim()) {
        title = submittedTitle.trim().slice(0, 120);
      }
      parsedResume = await parseResumeFile({
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } else {
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
      title = parsed.data.title;
      parsedResume = parseResumeStructure(parsed.data.rawText, {
        mediaType: "text/plain",
        parser: "manual",
      });
    }
    const parseCompletedAt = Date.now();
    const { rawText, skills, content } = parsedResume;

    // Instant path (Phase 3): deterministic extraction + baseline ATS score
    // only — no AI call — so the response never waits on OpenAI.
    const deterministicStart = Date.now();
    const profile = extractCareerProfile(parsedResume);
    const deterministicExtractionMs = Date.now() - deterministicStart;
    const atsScore = calculateAtsReadinessScore(profile, rawText);
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

    const contentWithProfile = {
      ...content,
      profile,
      atsScore,
      enrichment: { status: aiConfigured ? "pending" : "skipped" },
    } as unknown as Prisma.InputJsonValue;

    const resume = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterResume.findUnique({
        where: { userId: user.id },
      });
      if (!existing) {
        return tx.masterResume.create({
          data: {
            userId: user.id,
            title,
            content: contentWithProfile,
            rawText,
            skills,
            experience: profile.experience.value as unknown as Prisma.InputJsonValue,
            education: profile.education.value as unknown as Prisma.InputJsonValue,
            projects: profile.projects.value as unknown as Prisma.InputJsonValue,
            version: 1,
          },
        });
      }

      await tx.masterResumeVersion.create({
        data: {
          masterResumeId: existing.id,
          userId: user.id,
          version: existing.version,
          title: existing.title,
          content: existing.content as Prisma.InputJsonValue,
          rawText: existing.rawText,
          skills: existing.skills,
        },
      });
      return tx.masterResume.update({
        where: { id: existing.id },
        data: {
          title,
          content: contentWithProfile,
          rawText,
          skills,
          experience: profile.experience.value as unknown as Prisma.InputJsonValue,
          education: profile.education.value as unknown as Prisma.InputJsonValue,
          projects: profile.projects.value as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "RESUME_UPLOADED",
      resource: "master_resume",
      resourceId: resume.id,
      message: `Master resume updated with ${skills.length} skills detected`,
      level: "AUDIT",
      metadata: { atsScore: atsScore.totalScore, deterministicExtractionMs },
    });

    // Phase 3 + Phase G: AI enrichment (if configured) is queued as a
    // durable BackgroundJob rather than a bare after() call — after() is
    // still the immediate kick (claims and runs it in this same request's
    // execution window when possible), but if that doesn't finish in time
    // the job stays "pending" and the existing cron drain recovers it. The
    // user already has their baseline score and profile either way.
    if (aiConfigured) {
      const enrichJob = await enqueueJob(
        "ENRICH_RESUME",
        { userId: user.id, resumeId: resume.id },
        { priority: 100, source: "interactive" }
      );
      after(() => {
        claimAndProcessJob(enrichJob.id).catch((err) =>
          console.error("[resumes/master] background enrichment kick failed:", err)
        );
      });
    }

    const totalMs = Date.now() - parseCompletedAt;
    const response = NextResponse.json({
      ...resume,
      profile,
      atsScore,
      enrichmentPending: aiConfigured,
    });
    response.headers.set(
      "Server-Timing",
      `deterministicExtractionMs;dur=${deterministicExtractionMs}, totalMs;dur=${totalMs}`
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message === "Unauthorized"
        ? 401
        : /upload|empty|mb or smaller|enough readable text|scanned pdfs|choose a pdf/i.test(
              message
            )
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const result = await prisma.masterResume.deleteMany({
      where: { userId: user.id },
    });
    if (result.count > 0) {
      await createAuditLog({
        userId: user.id,
        action: "RESUME_DELETED",
        resource: "master_resume",
        message: "Master resume deleted by user",
        level: "AUDIT",
      });
    }
    return NextResponse.json({ deleted: result.count > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
