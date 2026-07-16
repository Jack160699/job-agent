import type { JobSource } from "@prisma/client";

export interface MatchCandidate {
  source: JobSource;
  externalId?: string | null;
  canonicalUrl: string;
  fingerprint: string;
}

export interface ExistingJobRecord {
  id: string;
  source: JobSource;
  externalId: string | null;
  canonicalUrl: string | null;
  descriptionFingerprint: string | null;
}

/**
 * Builds O(1) lookup maps from a bulk-fetched set of existing jobs, keyed by
 * the same three identity signals the search pipeline uses to decide
 * update-vs-create: source+externalId, canonicalUrl, descriptionFingerprint.
 * This is the in-memory half of the N+1 fix — a single bulk `findMany`
 * replaces one `findFirst` per candidate job.
 */
export function buildJobLookup(existingJobs: ExistingJobRecord[]) {
  const bySourceExternalId = new Map<string, ExistingJobRecord>();
  const byCanonicalUrl = new Map<string, ExistingJobRecord>();
  const byFingerprint = new Map<string, ExistingJobRecord>();

  for (const job of existingJobs) {
    if (job.externalId) bySourceExternalId.set(`${job.source}:${job.externalId}`, job);
    if (job.canonicalUrl) byCanonicalUrl.set(job.canonicalUrl, job);
    if (job.descriptionFingerprint) byFingerprint.set(job.descriptionFingerprint, job);
  }

  return {
    findExisting(candidate: MatchCandidate): ExistingJobRecord | undefined {
      if (candidate.externalId) {
        const hit = bySourceExternalId.get(`${candidate.source}:${candidate.externalId}`);
        if (hit) return hit;
      }
      return byCanonicalUrl.get(candidate.canonicalUrl) ?? byFingerprint.get(candidate.fingerprint);
    },
  };
}

/** Partitions candidates into updates (matched an existing job) and creates (no match). */
export function partitionByExistence<T extends MatchCandidate>(
  candidates: T[],
  existingJobs: ExistingJobRecord[]
): { toUpdate: Array<{ id: string; candidate: T }>; toCreate: T[] } {
  const lookup = buildJobLookup(existingJobs);
  const toUpdate: Array<{ id: string; candidate: T }> = [];
  const toCreate: T[] = [];

  for (const candidate of candidates) {
    const existing = lookup.findExisting(candidate);
    if (existing) toUpdate.push({ id: existing.id, candidate });
    else toCreate.push(candidate);
  }

  return { toUpdate, toCreate };
}
