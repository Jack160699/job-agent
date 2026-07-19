import { describe, expect, it, vi } from "vitest";
import {
  __publicDiscoveryTest,
  discoverPublicJobs,
} from "./public-discovery";

const filters = {
  titles: ["Staff Nurse"],
  queries: [
    {
      title: "Staff Nurse",
      location: "Bengaluru",
      remoteScope: null,
      stage: "strict" as const,
      reasons: ["target role"],
    },
  ],
  locations: ["Bengaluru"],
};

describe("public job discovery", () => {
  it("accepts canonical LinkedIn Jobs URLs and rejects other domains", () => {
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "LINKEDIN",
        "https://in.linkedin.com/jobs/view/staff-nurse-at-hospital-123?trk=x"
      )
    ).toBe("https://in.linkedin.com/jobs/view/staff-nurse-at-hospital-123");
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "LINKEDIN",
        "https://example.com/jobs/view/fake"
      )
    ).toBeNull();
  });

  it("accepts canonical Naukri listing URLs", () => {
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "NAUKRI",
        "https://www.naukri.com/job-listings-staff-nurse-hospital-bengaluru-1?src=x"
      )
    ).toBe(
      "https://www.naukri.com/job-listings-staff-nurse-hospital-bengaluru-1"
    );
  });

  it("deduplicates, labels, and rejects expired indexed results", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: "Staff Nurse - Apollo Hospitals | LinkedIn",
                url: "https://in.linkedin.com/jobs/view/staff-nurse-at-apollo-123",
                description: "Registered nurse role in Bengaluru.",
              },
              {
                title: "Staff Nurse - Apollo Hospitals | LinkedIn",
                url: "https://in.linkedin.com/jobs/view/staff-nurse-at-apollo-123?trk=dup",
                description: "Duplicate indexed result.",
              },
              {
                title: "Nurse - Old Hospital | LinkedIn",
                url: "https://in.linkedin.com/jobs/view/nurse-at-old-456",
                description: "This job has expired.",
              },
            ],
          },
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const jobs = await discoverPublicJobs("LINKEDIN", filters, {
      fetcher,
      env: { BRAVE_SEARCH_API_KEY: "test-key" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "LINKEDIN",
      title: "Staff Nurse",
      company: "Apollo Hospitals",
      metadata: {
        provenance: "public_discovery",
        discoveryLabel: "Public discovery",
        authenticatedConnection: "Connection required",
      },
    });
  });

  it("reports quota exhaustion distinctly", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 429,
          headers: { "x-ratelimit-remaining": "0" },
        })
    ) as unknown as typeof fetch;
    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { BRAVE_SEARCH_API_KEY: "test-key" },
      })
    ).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
    });
  });

  it("returns an empty, truthful discovery when the provider has no indexed jobs", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ web: { results: [] } }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { BRAVE_SEARCH_API_KEY: "test-key" },
      })
    ).resolves.toEqual([]);
  });

  it("maps an indexed Naukri result to permitted metadata and its canonical URL", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: "Staff Nurse job in Apollo Hospitals at Bengaluru | Naukri",
                  url: "https://www.naukri.com/job-listings-staff-nurse-apollo-bengaluru-123?src=search",
                  description: "GNM or BSc Nursing. Patient care role.",
                },
              ],
            },
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const jobs = await discoverPublicJobs("NAUKRI", filters, {
      fetcher,
      env: { BRAVE_SEARCH_API_KEY: "test-key" },
    });
    expect(jobs[0]).toMatchObject({
      source: "NAUKRI",
      title: "Staff Nurse",
      company: "Apollo Hospitals",
      sourceUrl:
        "https://www.naukri.com/job-listings-staff-nurse-apollo-bengaluru-123",
    });
  });

  it("reports provider failures without exposing provider credentials", async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 503 })
    ) as unknown as typeof fetch;

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { BRAVE_SEARCH_API_KEY: "never-return-this-key" },
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: "Public-discovery provider returned HTTP 503.",
    });
  });

  it("reports missing provider configuration without claiming connection", async () => {
    await expect(
      discoverPublicJobs("NAUKRI", filters, { env: {} })
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });
});
