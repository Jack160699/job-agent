import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AshbyAdapter,
  LeverAdapter,
  WorkdayAdapter,
} from "@/lib/jobs/adapters";
import { WorkdayAutomator } from "@/lib/automation/workday";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public ATS detail extraction", () => {
  it("extracts a real Lever posting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "abc-123",
        text: "Senior Platform Engineer",
        hostedUrl: "https://jobs.lever.co/acme/abc-123",
        descriptionPlain: "Build reliable systems.",
        additionalPlain: "TypeScript and PostgreSQL.",
        createdAt: 1784073600000,
        categories: {
          location: "Remote",
          commitment: "Full-time",
          team: "Platform",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const job = await new LeverAdapter().getJobDetails(
      "https://jobs.lever.co/acme/abc-123"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/acme/abc-123",
      expect.any(Object)
    );
    expect(job).toEqual(
      expect.objectContaining({
        externalId: "abc-123",
        title: "Senior Platform Engineer",
        location: "Remote",
      })
    );
    expect(job?.description).toContain("PostgreSQL");
  });

  it("finds an Ashby posting on its public board", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          jobs: [
            {
              id: "job-42",
              title: "Product Engineer",
              location: "Bengaluru",
              descriptionHtml: "<p>Build <strong>useful</strong> software.</p>",
              jobUrl: "https://jobs.ashbyhq.com/acme/job-42",
              publishedAt: "2026-07-14T00:00:00.000Z",
            },
          ],
        })
      )
    );

    const job = await new AshbyAdapter().getJobDetails(
      "https://jobs.ashbyhq.com/acme/job-42"
    );

    expect(job?.title).toBe("Product Engineer");
    expect(job?.description).toBe("Build useful software.");
    expect(job?.metadata?.extractionMethod).toBe("ashby_job_board_api");
  });

  it("extracts a Workday posting through the CXS endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        jobPostingInfo: {
          jobReqId: "R100",
          title: "Software Engineer",
          jobDescription: "<p>Build cloud services.</p>",
          location: "Pune",
          postedOn: "2026-07-13",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const job = await new WorkdayAdapter().getJobDetails(
      "https://acme.wd5.myworkdayjobs.com/en-US/External/job/Pune/Software-Engineer_R100"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Pune/Software-Engineer_R100",
      expect.any(Object)
    );
    expect(job).toEqual(
      expect.objectContaining({
        externalId: "R100",
        title: "Software Engineer",
        company: "acme",
        location: "Pune",
      })
    );
  });

  it("discovers Workday jobs through the public CXS search API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        jobPostings: [
          {
            title: "Site Reliability Engineer",
            externalPath: "/job/Pune/SRE_R200",
            locationsText: "Pune",
            postedOn: "Posted 3 Days Ago",
            bulletFields: ["Cloud infrastructure", "On-call rotation"],
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await new WorkdayAutomator().discoverJobs(
      "https://acme.wd5.myworkdayjobs.com/en-US/External",
      "reliability"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs",
      expect.objectContaining({ method: "POST" })
    );
    expect(jobs[0]).toEqual(
      expect.objectContaining({
        externalId: "R200",
        title: "Site Reliability Engineer",
        sourceUrl:
          "https://acme.wd5.myworkdayjobs.com/job/Pune/SRE_R200",
      })
    );
    expect(jobs[0]?.postedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(jobs[0]?.postedAt?.getTime())).toBe(false);
  });

  it("returns null rather than fabricated placeholders on source failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 }))
    );

    await expect(
      new LeverAdapter().getJobDetails(
        "https://jobs.lever.co/acme/missing-posting"
      )
    ).resolves.toBeNull();
  });
});
