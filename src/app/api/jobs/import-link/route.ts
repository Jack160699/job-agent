import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiUser } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import {
  importJobLink,
  JobImportError,
} from "@/lib/jobs/import-link";

const manualSchema = z.object({
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(300),
  description: z.string().trim().min(80).max(100_000),
  location: z.string().trim().max(300).optional(),
  applicationUrl: z.string().trim().url().max(2_000).optional(),
});

const requestSchema = z.object({
  url: z.string().trim().min(1).max(2_000),
  manual: manualSchema.optional(),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.jobImport);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Check the job link and required fields.",
          code: "INVALID_REQUEST",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await importJobLink(user.id, parsed.data);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof JobImportError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
          needsManualDescription: [
            "PAGE_BLOCKED",
            "EXTRACTION_INCOMPLETE",
            "UNSUPPORTED_CONTENT",
            "HTTP_ERROR",
          ].includes(error.code),
        },
        { status: error.retryable ? 503 : 422 }
      );
    }

    const message = error instanceof Error ? error.message : "Job import failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Sign in to import a job."
            : "Kairela could not import this job right now. Your link was not marked as successful.",
        code: status === 401 ? "UNAUTHORIZED" : "IMPORT_FAILED",
        retryable: status !== 401,
      },
      { status }
    );
  }
}
