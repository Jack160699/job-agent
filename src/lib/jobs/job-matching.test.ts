import { describe, expect, it } from "vitest";
import { buildJobLookup, partitionByExistence, type ExistingJobRecord, type MatchCandidate } from "./job-matching";

function existing(overrides: Partial<ExistingJobRecord> = {}): ExistingJobRecord {
  return {
    id: "existing-1",
    source: "GREENHOUSE",
    externalId: null,
    canonicalUrl: null,
    descriptionFingerprint: null,
    ...overrides,
  };
}

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    source: "GREENHOUSE",
    externalId: null,
    canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
    fingerprint: "fp-1",
    ...overrides,
  };
}

describe("buildJobLookup / findExisting", () => {
  it("matches by source+externalId first", () => {
    const lookup = buildJobLookup([
      existing({ id: "by-ext", source: "GREENHOUSE", externalId: "123" }),
      existing({ id: "by-url", canonicalUrl: "https://x/1" }),
    ]);
    const hit = lookup.findExisting(
      candidate({ externalId: "123", canonicalUrl: "https://x/1" })
    );
    expect(hit?.id).toBe("by-ext");
  });

  it("falls back to canonicalUrl when no externalId match", () => {
    const lookup = buildJobLookup([existing({ id: "by-url", canonicalUrl: "https://x/1" })]);
    const hit = lookup.findExisting(candidate({ externalId: "999", canonicalUrl: "https://x/1" }));
    expect(hit?.id).toBe("by-url");
  });

  it("falls back to descriptionFingerprint last", () => {
    const lookup = buildJobLookup([
      existing({ id: "by-fp", descriptionFingerprint: "fp-1", canonicalUrl: null }),
    ]);
    const hit = lookup.findExisting(candidate({ canonicalUrl: "https://unmatched", fingerprint: "fp-1" }));
    expect(hit?.id).toBe("by-fp");
  });

  it("returns undefined when nothing matches (never invents a match)", () => {
    const lookup = buildJobLookup([existing({ canonicalUrl: "https://other" })]);
    expect(lookup.findExisting(candidate())).toBeUndefined();
  });

  it("does not cross-match externalId across different sources", () => {
    const lookup = buildJobLookup([existing({ source: "LEVER", externalId: "123" })]);
    const hit = lookup.findExisting(candidate({ source: "GREENHOUSE", externalId: "123", canonicalUrl: "https://nomatch" }));
    expect(hit).toBeUndefined();
  });
});

describe("partitionByExistence", () => {
  it("splits candidates into updates and creates using one bulk existing-job list", () => {
    const candidates = [
      { ...candidate({ canonicalUrl: "https://x/1" }), label: "will-update" },
      { ...candidate({ canonicalUrl: "https://x/2", fingerprint: "fp-2" }), label: "will-create" },
    ];
    const { toUpdate, toCreate } = partitionByExistence(candidates, [
      existing({ id: "existing-x1", canonicalUrl: "https://x/1" }),
    ]);

    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0].id).toBe("existing-x1");
    expect(toUpdate[0].candidate.label).toBe("will-update");

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].label).toBe("will-create");
  });

  it("creates everything when no existing jobs are passed", () => {
    const candidates = [candidate(), candidate({ canonicalUrl: "https://x/2" })];
    const { toUpdate, toCreate } = partitionByExistence(candidates, []);
    expect(toUpdate).toHaveLength(0);
    expect(toCreate).toHaveLength(2);
  });
});
