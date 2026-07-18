import prisma from "@/lib/db";
import { extractCareerProfile, type ParsedCareerProfile } from "./career-profile";
import { enhanceCareerProfileWithAI } from "./career-profile-ai";
import { calculateAtsReadinessScore, type AtsReadinessScore } from "./ats-score";
import type { Prisma } from "@prisma/client";

type StoredResumeContent = {
  sections: unknown;
  source: unknown;
  profile: ParsedCareerProfile;
  atsScore: AtsReadinessScore;
  enrichment: { status: "pending" | "complete" | "skipped" | "failed"; completedAt?: string };
};

/**
 * Durable AI enrichment (Phase G): runs as a claimed BackgroundJob
 * ("ENRICH_RESUME") rather than relying solely on a single after() call
 * completing within one request's execution budget. after() is still used
 * as the immediate kick (see /api/resumes/master), but if that doesn't
 * finish in time, the job stays "pending" in the same queue the interactive
 * job-search kick uses and the existing cron drain picks it up as recovery
 * — enrichment is never silently lost.
 *
 * Never overwrites a field the deterministic pass already found (grounded,
 * fill-only-if-empty via enhanceCareerProfileWithAI) — the already-returned
 * deterministic score always stands even if this never runs at all.
 */
export async function enrichMasterResume(userId: string, resumeId: string): Promise<{ status: string }> {
  const current = await prisma.masterResume.findUnique({ where: { id: resumeId } });
  if (!current || current.userId !== userId) {
    return { status: "skipped_not_found" };
  }
  const currentContent = (current.content as Partial<StoredResumeContent> | null) ?? {};
  const deterministic = currentContent.profile ?? extractCareerProfile({
    rawText: current.rawText,
    skills: current.skills,
    content: { sections: [], source: { mediaType: "text/plain", parser: "unknown" } },
  });

  try {
    const enriched = await enhanceCareerProfileWithAI(deterministic, current.rawText);
    const enrichedScore = calculateAtsReadinessScore(enriched, current.rawText);

    await prisma.masterResume.update({
      where: { id: resumeId },
      data: {
        content: {
          ...currentContent,
          profile: enriched,
          atsScore: enrichedScore,
          enrichment: { status: "complete", completedAt: new Date().toISOString() },
        } as unknown as Prisma.InputJsonValue,
        experience: enriched.experience.value as unknown as Prisma.InputJsonValue,
        education: enriched.education.value as unknown as Prisma.InputJsonValue,
        projects: enriched.projects.value as unknown as Prisma.InputJsonValue,
      },
    });
    return { status: "complete" };
  } catch (error) {
    await prisma.masterResume
      .update({
        where: { id: resumeId },
        data: {
          content: {
            ...currentContent,
            enrichment: { status: "failed" },
          } as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => {});
    throw error;
  }
}
