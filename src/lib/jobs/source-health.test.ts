import { describe, expect, it } from "vitest";
import {
  shouldTemporarilyDisableSource,
  sourceHealthRates,
} from "./source-health";

const healthy = {
  requests: 10,
  successfulResponses: 9,
  emptyResponses: 1,
  invalidJobs: 0,
  duplicates: 2,
  expiredJobs: 1,
  failures: 1,
  relevanceTotal: 150,
  relevanceSamples: 2,
  consecutiveFailures: 0,
  disabledUntil: null,
};

describe("source health", () => {
  it("computes reliability and quality rates", () => {
    const rates = sourceHealthRates(healthy);
    expect(rates.failureRate).toBe(0.1);
    expect(rates.averageRelevance).toBe(75);
  });

  it("keeps healthy sources enabled", () => {
    expect(shouldTemporarilyDisableSource(healthy).disabled).toBe(false);
  });

  it("temporarily disables repeatedly failing sources", () => {
    const result = shouldTemporarilyDisableSource({
      ...healthy,
      requests: 5,
      failures: 4,
      consecutiveFailures: 3,
    });
    expect(result.disabled).toBe(true);
    expect(result.until).toBeInstanceOf(Date);
  });

  it("does not globally disable a source from one user's feedback", () => {
    const userA = shouldTemporarilyDisableSource({
      ...healthy,
      relevanceTotal: 10,
      relevanceSamples: 1,
    });
    const userB = shouldTemporarilyDisableSource(healthy);
    expect(userA.disabled).toBe(true);
    expect(userB.disabled).toBe(false);
  });

  it("allows a recovery probe after a persisted cooldown expires", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const result = shouldTemporarilyDisableSource(
      {
        ...healthy,
        requests: 8,
        failures: 8,
        consecutiveFailures: 8,
        disabledUntil: new Date("2026-07-15T11:00:00Z"),
      },
      now
    );
    expect(result.disabled).toBe(false);
  });
});
