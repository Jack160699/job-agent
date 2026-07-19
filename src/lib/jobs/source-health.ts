import type { JobSource } from "@prisma/client";

export interface SourceHealthSnapshot {
  requests: number;
  successfulResponses: number;
  emptyResponses: number;
  invalidJobs: number;
  duplicates: number;
  expiredJobs: number;
  failures: number;
  relevanceTotal: number;
  relevanceSamples: number;
  consecutiveFailures: number;
  disabledUntil?: Date | null;
}

export function sourceHealthRates(snapshot: SourceHealthSnapshot) {
  const requests = Math.max(1, snapshot.requests);
  return {
    failureRate: snapshot.failures / requests,
    emptyRate: snapshot.emptyResponses / requests,
    duplicateRate:
      snapshot.successfulResponses > 0
        ? snapshot.duplicates / snapshot.successfulResponses
        : 0,
    expiredRate:
      snapshot.successfulResponses > 0
        ? snapshot.expiredJobs / snapshot.successfulResponses
        : 0,
    averageRelevance:
      snapshot.relevanceSamples > 0
        ? snapshot.relevanceTotal / snapshot.relevanceSamples
        : null,
  };
}

export function shouldTemporarilyDisableSource(
  snapshot: SourceHealthSnapshot,
  now = new Date()
): { disabled: boolean; reason?: string; until?: Date } {
  if (snapshot.disabledUntil) {
    if (snapshot.disabledUntil > now) {
      return {
        disabled: true,
        reason: "Source is in a temporary cooldown",
        until: snapshot.disabledUntil,
      };
    }
    // Permit one recovery probe after the persisted cooldown expires.
    return { disabled: false };
  }
  const rates = sourceHealthRates(snapshot);
  if (
    snapshot.requests >= 5 &&
    (snapshot.consecutiveFailures >= 3 || rates.failureRate >= 0.6)
  ) {
    return {
      disabled: true,
      reason: "Source failure rate exceeded the safe threshold",
      until: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }
  if (
    snapshot.requests >= 8 &&
    rates.averageRelevance != null &&
    rates.averageRelevance < 25
  ) {
    return {
      disabled: true,
      reason: "Source relevance is temporarily too low for this user",
      until: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    };
  }
  return { disabled: false };
}

export interface SourceFetchResult {
  source: JobSource;
  requested: boolean;
  success: boolean;
  fetched: number;
  invalid: number;
  duplicates: number;
  expired: number;
  relevant: number;
  durationMs?: number;
  lastSuccessfulFetch?: string;
  error?: string;
}
