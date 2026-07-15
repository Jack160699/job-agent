import { createHash } from "crypto";
import type { DiscoveredJob } from "./types";
import { normalizeLocation, normalizeText, normalizeTitle } from "./normalization";

export function canonicalizeJobUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["source", "ref", "referrer", "gh_src"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function descriptionFingerprint(description: string): string {
  return createHash("sha256")
    .update(normalizeText(description).slice(0, 12_000))
    .digest("hex");
}

export function jobIdentityKeys(job: DiscoveredJob): string[] {
  const location = normalizeLocation(job.location ?? "");
  const title = normalizeTitle(job.title);
  return [
    ...(job.externalId ? [`external:${job.source}:${job.externalId}`] : []),
    `url:${canonicalizeJobUrl(job.sourceUrl)}`,
    `semantic:${normalizeText(job.company)}:${title.normalized}:${location.group ?? location.normalized}`,
    `description:${descriptionFingerprint(job.description)}`,
  ];
}

export interface DeduplicatedJob extends DiscoveredJob {
  provenance: Array<{
    source: DiscoveredJob["source"];
    sourceUrl: string;
    externalId?: string;
  }>;
  canonicalUrl: string;
  fingerprint: string;
}

export function deduplicateJobs(jobs: DiscoveredJob[]): {
  jobs: DeduplicatedJob[];
  duplicateCount: number;
} {
  const results: DeduplicatedJob[] = [];
  const keyToIndex = new Map<string, number>();
  let duplicateCount = 0;

  for (const job of jobs) {
    const keys = jobIdentityKeys(job);
    const existingIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((index): index is number => index != null);
    if (existingIndex != null) {
      duplicateCount++;
      const existing = results[existingIndex];
      const provenance = {
        source: job.source,
        sourceUrl: job.sourceUrl,
        externalId: job.externalId,
      };
      if (
        !existing.provenance.some(
          (entry) =>
            entry.source === provenance.source &&
            entry.sourceUrl === provenance.sourceUrl
        )
      ) {
        existing.provenance.push(provenance);
      }
      if (!existing.postedAt && job.postedAt) existing.postedAt = job.postedAt;
      continue;
    }

    const record: DeduplicatedJob = {
      ...job,
      canonicalUrl: canonicalizeJobUrl(job.sourceUrl),
      fingerprint: descriptionFingerprint(job.description),
      provenance: [
        {
          source: job.source,
          sourceUrl: job.sourceUrl,
          externalId: job.externalId,
        },
      ],
    };
    const index = results.push(record) - 1;
    for (const key of keys) keyToIndex.set(key, index);
  }

  return { jobs: results, duplicateCount };
}
