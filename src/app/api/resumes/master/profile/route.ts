import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";
import { extractCareerProfile, type ParsedCareerProfile } from "@/lib/resumes/career-profile";
import { calculateAtsReadinessScore, type AtsReadinessScore } from "@/lib/resumes/ats-score";
import { applyProfileEdits, type ProfileEdits } from "@/lib/resumes/profile-edit";
import type { Prisma } from "@prisma/client";

type StoredContent = {
  sections: unknown;
  source: unknown;
  profile: ParsedCareerProfile;
  atsScore: AtsReadinessScore;
  enrichment: { status: "pending" | "complete" | "skipped" | "failed"; completedAt?: string };
};

const experienceEntrySchema = z.object({
  title: z.string().trim().max(200).nullable(),
  company: z.string().trim().max(200).nullable(),
  location: z.string().trim().max(200).nullable(),
  startDate: z.string().trim().max(50).nullable(),
  endDate: z.string().trim().max(50).nullable(),
  current: z.boolean(),
  description: z.string().trim().max(4000).nullable(),
  evidence: z.string().max(4000).default("user-entered"),
});

const educationEntrySchema = z.object({
  degree: z.string().trim().max(200).nullable(),
  institution: z.string().trim().max(200).nullable(),
  field: z.string().trim().max(200).nullable(),
  startDate: z.string().trim().max(50).nullable(),
  endDate: z.string().trim().max(50).nullable(),
  evidence: z.string().max(4000).default("user-entered"),
});

const projectEntrySchema = z.object({
  name: z.string().trim().max(200).nullable(),
  description: z.string().trim().max(4000).nullable(),
  technologies: z.array(z.string().trim().max(80)).max(50),
  evidence: z.string().max(4000).default("user-entered"),
});

const editsSchema = z.object({
  professionalSummary: z.string().trim().max(2000).nullable().optional(),
  experience: z.array(experienceEntrySchema).max(60).optional(),
  education: z.array(educationEntrySchema).max(60).optional(),
  projects: z.array(projectEntrySchema).max(60).optional(),
  certifications: z.array(z.string().trim().max(200)).max(100).optional(),
  languages: z.array(z.string().trim().max(80)).max(50).optional(),
});

/**
 * Phase A: structured section edits (experience, education, projects,
 * certifications, languages, summary) for the persisted master resume — used
 * by both the onboarding review screen and the ongoing Resume Manager
 * editor. Every save versions the master resume the same way a full
 * re-upload does, so edit history is never lost.
 */
export async function PATCH(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = editsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid edit payload" },
        { status: 400 }
      );
    }
    const edits = parsed.data as ProfileEdits;

    const existing = await prisma.masterResume.findUnique({ where: { userId: user.id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Upload a resume before editing its sections." },
        { status: 404 }
      );
    }

    const currentContent = (existing.content as Partial<StoredContent> | null) ?? {};
    const currentProfile: ParsedCareerProfile =
      currentContent.profile ??
      extractCareerProfile({
        rawText: existing.rawText,
        skills: existing.skills,
        content: { sections: [], source: { mediaType: "text/plain", parser: "unknown" } },
      });

    const editedProfile = applyProfileEdits(currentProfile, edits);
    const editedScore = calculateAtsReadinessScore(editedProfile, existing.rawText);

    const contentWithProfile = {
      ...currentContent,
      profile: editedProfile,
      atsScore: editedScore,
    } as unknown as Prisma.InputJsonValue;

    const resume = await prisma.$transaction(async (tx) => {
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
          content: contentWithProfile,
          experience: editedProfile.experience.value as unknown as Prisma.InputJsonValue,
          education: editedProfile.education.value as unknown as Prisma.InputJsonValue,
          projects: editedProfile.projects.value as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "RESUME_SECTION_EDITED",
      resource: "master_resume",
      resourceId: resume.id,
      message: `Edited sections: ${Object.keys(edits).join(", ") || "none"}`,
      level: "AUDIT",
      metadata: { atsScore: editedScore.totalScore, editedSections: Object.keys(edits) },
    });

    return NextResponse.json({ ...resume, profile: editedProfile, atsScore: editedScore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
