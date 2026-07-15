import { describe, expect, it } from "vitest";
import {
  canonicalizeJobUrl,
  deduplicateJobs,
  descriptionFingerprint,
} from "./deduplication";
import type { DiscoveredJob } from "./types";

function job(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    externalId: "job-1",
    source: "GREENHOUSE",
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/1?utm_source=test",
    title: "Software Engineer",
    company: "Acme",
    location: "Bengaluru, India",
    description: "Build APIs with Node.js and PostgreSQL.",
    ...overrides,
  };
}

describe("job deduplication", () => {
  it("canonicalizes tracking URLs", () => {
    expect(
      canonicalizeJobUrl(
        "https://EXAMPLE.com/jobs/1/?utm_source=x&ref=feed"
      )
    ).toBe("https://example.com/jobs/1");
  });

  it("deduplicates the same role across ATS sources and keeps provenance", () => {
    const result = deduplicateJobs([
      job(),
      job({
        externalId: "lever-2",
        source: "LEVER",
        sourceUrl: "https://jobs.lever.co/acme/lever-2",
      }),
    ]);

    expect(result.jobs).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.jobs[0].provenance).toHaveLength(2);
  });

  it("uses a stable description fingerprint", () => {
    expect(descriptionFingerprint("Build APIs\nwith Node.js")).toBe(
      descriptionFingerprint("Build APIs with Node.js")
    );
  });
});
