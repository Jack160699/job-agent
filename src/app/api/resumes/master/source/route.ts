import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { resolveApiUser, prisma } from "@/lib/api/auth";
import { createOriginalResumeSignedUrl } from "@/lib/resumes/resume-source";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

type ResumeSourceRow = {
  storage_path: string;
};

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.resume);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const sources = await prisma.$queryRaw<ResumeSourceRow[]>(Prisma.sql`
      SELECT rs.storage_path
      FROM public.resume_sources rs
      INNER JOIN public.master_resume mr
        ON mr.id = rs.master_resume_id
       AND mr.user_id = ${user.id}::uuid
      WHERE rs.user_id = ${user.id}::uuid
        AND rs.source_type = 'file'
        AND rs.is_original_preserved = true
        AND rs.storage_path IS NOT NULL
      ORDER BY rs.created_at DESC
      LIMIT 1
    `);
    const source = sources[0];
    if (!source) {
      return NextResponse.json(
        { error: "No original uploaded file is available." },
        { status: 404 }
      );
    }
    const signedUrl = await createOriginalResumeSignedUrl({
      userId: user.id,
      storagePath: source.storage_path,
    });
    return NextResponse.redirect(signedUrl, 307);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Original resume is unavailable";
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
