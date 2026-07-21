import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __publicDiscoveryTest,
  beginPublicDiscoveryRun,
  configuredPublicSearchProviders,
  discoverPublicJobs,
  getPublicSearchProviderHealth,
} from "./public-discovery";

const filters = {
  titles: ["Staff Nurse", "Registered Nurse"],
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
  beforeEach(() => {
    __publicDiscoveryTest.resetProtectionState();
  });

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
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "LINKEDIN",
        "https://www.linkedin.com/jobs/search/?keywords=nurse"
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

  it("validates individual jobs for expanded Indian public sources", () => {
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "INDEED",
        "https://in.indeed.com/viewjob?jk=abc123&utm_source=index"
      )
    ).toBe("https://in.indeed.com/viewjob?jk=abc123");
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "FOUNDIT",
        "https://www.foundit.in/job/banking-operations-123"
      )
    ).toBe("https://www.foundit.in/job/banking-operations-123");
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "INTERNSHALA",
        "https://internshala.com/job/detail/graduate-trainee-123"
      )
    ).toBe("https://internshala.com/job/detail/graduate-trainee-123");
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "WELLFOUND",
        "https://wellfound.com/jobs"
      )
    ).toBeNull();
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "INDEED",
        "https://in.indeed.com/jobs?q=nurse&l=India"
      )
    ).toBeNull();
    expect(
      __publicDiscoveryTest.canonicalIndexedJobUrl(
        "LINKEDIN",
        "not-a-url"
      )
    ).toBeNull();
  });

  it("prefers Serper when SERPER_API_KEY is present and keeps SerpAPI aliases", () => {
    expect(
      configuredPublicSearchProviders({ SERPER_API_KEY: "configured" })
    ).toEqual(["serper"]);
    expect(
      configuredPublicSearchProviders({
        SERPER_API_KEY: "serper",
        SERPAPI_KEY: "serpapi",
        BRAVE_SEARCH_API_KEY: "brave",
      })
    ).toEqual(["serper", "brave"]);
    expect(configuredPublicSearchProviders({ SERPAPI_KEY: "configured" })).toEqual([
      "serpapi",
    ]);
    expect(
      configuredPublicSearchProviders({ SERPAPI_API_KEY: "legacy" })
    ).toEqual(["serpapi"]);
  });

  it("combines related titles into one domain-restricted query", () => {
    const queries = __publicDiscoveryTest.publicDiscoveryQueries("LINKEDIN", filters);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('site:linkedin.com/jobs/view');
    expect(queries[0]).toContain('"Staff Nurse"');
    expect(queries[0]).toContain('"Registered Nurse"');
    expect(queries[0]).toContain('"Bengaluru"');
  });

  it("deduplicates, labels, and rejects expired indexed results", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          organic: [
            {
              title: "Staff Nurse - Apollo Hospitals | LinkedIn",
              link: "https://in.linkedin.com/jobs/view/staff-nurse-at-apollo-123",
              snippet: "Registered nurse role in Bengaluru.",
            },
            {
              title: "Staff Nurse - Apollo Hospitals | LinkedIn",
              link: "https://in.linkedin.com/jobs/view/staff-nurse-at-apollo-123?trk=dup",
              snippet: "Duplicate indexed result.",
            },
            {
              title: "Nurse - Old Hospital | LinkedIn",
              link: "https://in.linkedin.com/jobs/view/nurse-at-old-456",
              snippet: "This job has expired.",
            },
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const jobs = await discoverPublicJobs("LINKEDIN", filters, {
      fetcher,
      env: { SERPER_API_KEY: "test-key" },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "LINKEDIN",
      title: "Staff Nurse",
      company: "Apollo Hospitals",
      metadata: {
        provenance: "public_discovery",
        discoveryLabel: "Public discovery",
        authenticatedConnection:
          "Authentication still required for protected functions",
        easyApplyClaim: false,
        provider: "serper",
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
        env: { SERPER_API_KEY: "test-key" },
      })
    ).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
    });
  });

  it("reports authentication failure and skips further calls for that provider", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 })
    );

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher: fetcher as unknown as typeof fetch,
        env: { SERPER_API_KEY: "bad-key", SERPAPI_KEY: "also-bad" },
      })
    ).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
    });

    expect(fetcher).toHaveBeenCalled();
    const firstCalls = fetcher.mock.calls.length;

    await expect(
      discoverPublicJobs("NAUKRI", filters, {
        fetcher: fetcher as unknown as typeof fetch,
        env: { SERPER_API_KEY: "bad-key", SERPAPI_KEY: "also-bad" },
      })
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetcher.mock.calls.length).toBe(firstCalls);
  });

  it("returns an empty, truthful discovery when the provider has no indexed jobs", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ organic: [] }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { SERPER_API_KEY: "test-key" },
      })
    ).resolves.toEqual([]);
  });

  it("maps an indexed Naukri result to permitted metadata and its canonical URL", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            organic: [
              {
                title: "Staff Nurse job in Apollo Hospitals at Bengaluru | Naukri",
                link: "https://www.naukri.com/job-listings-staff-nurse-apollo-bengaluru-123?src=search",
                snippet: "GNM or BSc Nursing. Patient care role.",
              },
            ],
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const jobs = await discoverPublicJobs("NAUKRI", filters, {
      fetcher,
      env: { SERPER_API_KEY: "test-key" },
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

    const error = await discoverPublicJobs("LINKEDIN", filters, {
      fetcher,
      env: { SERPER_API_KEY: "never-return-this-key" },
    }).catch((err: Error) => err);

    expect(error).toMatchObject({
      code: "PROVIDER_ERROR",
      message: "Public-discovery provider returned HTTP 503.",
    });
    expect(String(error)).not.toContain("never-return-this-key");
  });

  it("fails over to the next configured provider", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            web: {
              results: [
                {
                  title: "Staff Nurse - Apollo Hospitals | LinkedIn",
                  url: "https://in.linkedin.com/jobs/view/staff-nurse-987",
                  description: "Current nursing role.",
                },
              ],
            },
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

    const jobs = await discoverPublicJobs("LINKEDIN", filters, {
      fetcher,
      env: {
        SERPER_API_KEY: "serper",
        BRAVE_SEARCH_API_KEY: "brave",
      },
    });
    expect(jobs[0]?.metadata?.provider).toBe("brave");
  });

  it("caches identical searches to protect provider quota", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ organic: [] }), { status: 200 })
    ) as unknown as typeof fetch;
    const options = {
      fetcher,
      env: { SERPER_API_KEY: "test-key" },
    };
    await discoverPublicJobs("LINKEDIN", filters, options);
    await discoverPublicJobs("LINKEDIN", filters, options);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("respects per-run search budget without failing the whole discovery soft-path", async () => {
    beginPublicDiscoveryRun(null, { PUBLIC_SEARCH_MAX_QUERIES_PER_RUN: "1" });
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            organic: [
              {
                title: "Staff Nurse - Apollo | LinkedIn",
                link: "https://in.linkedin.com/jobs/view/staff-nurse-1",
                snippet: "Open role",
              },
            ],
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;

    const first = await discoverPublicJobs("LINKEDIN", filters, {
      fetcher,
      env: { SERPER_API_KEY: "test-key" },
    });
    expect(first).toHaveLength(1);

    const second = await discoverPublicJobs("NAUKRI", filters, {
      fetcher,
      env: { SERPER_API_KEY: "test-key" },
    });
    expect(second).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("treats timeout as temporarily unavailable", async () => {
    const fetcher = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    }) as unknown as typeof fetch;

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { SERPER_API_KEY: "test-key" },
      })
    ).rejects.toMatchObject({
      code: "TEMPORARILY_UNAVAILABLE",
    });
  });

  it("rejects invalid Serper JSON payloads", async () => {
    const fetcher = vi.fn(
      async () => new Response("not-json", { status: 200 })
    ) as unknown as typeof fetch;

    await expect(
      discoverPublicJobs("LINKEDIN", filters, {
        fetcher,
        env: { SERPER_API_KEY: "test-key" },
      })
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("reports missing provider configuration without claiming connection", async () => {
    await expect(
      discoverPublicJobs("NAUKRI", filters, { env: {} })
    ).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });

  it("exposes privacy-safe provider health without secrets", () => {
    const health = getPublicSearchProviderHealth({
      SERPER_API_KEY: "secret-value-must-not-appear",
    });
    const serper = health.find((item) => item.name === "serper");
    expect(serper?.configured).toBe(true);
    expect(serper?.status).toBe("configured");
    expect(JSON.stringify(health)).not.toContain("secret-value-must-not-appear");
  });
});
