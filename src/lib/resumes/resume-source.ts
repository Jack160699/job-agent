import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createServiceClient } from "@/lib/supabase/server";

const RESUME_BUCKET = "resume-sources";
const PARSER_VERSION = "deterministic-2026-07-v1";
const SCHEMA_VERSION = "career-profile-v1";

export interface ResumeSourceRecord {
  sourceType: "file" | "manual";
  originalFilename: string | null;
  mediaType: string;
  storagePath: string | null;
  contentSha256: string;
  byteSize: number;
  rawText: string;
  parser: string;
}

export function sha256Resume(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function preserveResumeFile(input: {
  userId: string;
  filename: string;
  mediaType: string;
  bytes: Uint8Array;
  contentSha256: string;
}): Promise<string> {
  const extension = input.filename.toLowerCase().split(".").pop();
  if (!extension || !["pdf", "docx", "txt"].includes(extension)) {
    throw new Error("Unsupported resume file extension");
  }
  const path = `${input.userId}/${input.contentSha256}.${extension}`;
  const supabase = await createServiceClient();
  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(path, input.bytes, {
      contentType: input.mediaType,
      upsert: true,
      cacheControl: "3600",
    });
  if (error) {
    throw new Error("The resume was parsed but its original file could not be securely stored.");
  }
  return path;
}

export async function recordResumeSource(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    masterResumeId: string;
    source: ResumeSourceRecord;
  }
): Promise<void> {
  const { userId, masterResumeId, source } = input;
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO public.resume_sources (
      user_id, master_resume_id, source_type, original_filename, media_type,
      storage_path, content_sha256, byte_size, raw_text,
      is_original_preserved
    )
    VALUES (
      ${userId}::uuid, ${masterResumeId}::uuid, ${source.sourceType},
      ${source.originalFilename}, ${source.mediaType}, ${source.storagePath},
      ${source.contentSha256}, ${source.byteSize}, ${source.rawText},
      ${source.sourceType === "manual" || Boolean(source.storagePath)}
    )
    ON CONFLICT (user_id, content_sha256) DO UPDATE SET
      master_resume_id = EXCLUDED.master_resume_id,
      original_filename = EXCLUDED.original_filename,
      media_type = EXCLUDED.media_type,
      storage_path = COALESCE(EXCLUDED.storage_path, public.resume_sources.storage_path),
      raw_text = EXCLUDED.raw_text,
      is_original_preserved =
        public.resume_sources.is_original_preserved OR EXCLUDED.is_original_preserved
    RETURNING id
  `);
  const sourceId = rows[0]?.id;
  if (!sourceId) throw new Error("RESUME_SOURCE_RECORD_FAILED");
  const idempotencyKey = `${source.contentSha256}:${PARSER_VERSION}:${SCHEMA_VERSION}`;
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO public.resume_parse_runs (
      user_id, resume_source_id, status, parser_version, provider,
      schema_version, idempotency_key, started_at, completed_at
    )
    VALUES (
      ${userId}::uuid, ${sourceId}::uuid, 'complete', ${PARSER_VERSION},
      ${source.parser}, ${SCHEMA_VERSION}, ${idempotencyKey}, now(), now()
    )
    ON CONFLICT (user_id, idempotency_key) DO UPDATE SET
      resume_source_id = EXCLUDED.resume_source_id,
      status = 'complete',
      error_code = NULL,
      error_message = NULL,
      completed_at = now()
  `);
}

export async function createOriginalResumeSignedUrl(input: {
  userId: string;
  storagePath: string;
}): Promise<string> {
  if (!input.storagePath.startsWith(`${input.userId}/`)) {
    throw new Error("Resume source ownership mismatch");
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(input.storagePath, 60);
  if (error || !data?.signedUrl) {
    throw new Error("Original resume is temporarily unavailable");
  }
  return data.signedUrl;
}
