import { describe, expect, it } from "vitest";
import {
  extractGovernmentDeadline,
  OFFICIAL_GOVERNMENT_SOURCES,
  parseOfficialGovernmentJobs,
} from "./government-adapters";

const source = OFFICIAL_GOVERNMENT_SOURCES.find((item) => item.source === "ISRO")!;

describe("official government job adapters", () => {
  it("registers ten separately observable official sources", () => {
    expect(OFFICIAL_GOVERNMENT_SOURCES.map((item) => item.source)).toEqual([
      "UPSC",
      "ISRO",
      "NTPC",
      "BEL",
      "IOCL",
      "IBPS",
      "RAILWAYS",
      "SSC",
      "DRDO",
      "RBI",
    ]);
    expect(new Set(OFFICIAL_GOVERNMENT_SOURCES.map((item) => item.pageUrl)).size).toBe(10);
    expect(
      OFFICIAL_GOVERNMENT_SOURCES.filter((item) => item.searchable).map(
        (item) => item.source
      )
    ).toEqual(["UPSC", "ISRO", "NTPC", "DRDO"]);
  });

  it("extracts official notices, attribution, advertisement numbers, and deadlines", () => {
    const html = `
      <section class="job-notification">
        <h3>Advt. No. ISTRAC:02:2026 — Recruitment of Technician B</h3>
        <p>Last Date to Apply: 31-07-2026</p>
        <a href="/careers/istrac-02-2026.html">Read more</a>
      </section>
    `;
    const jobs = parseOfficialGovernmentJobs(
      html,
      source,
      new Date("2026-07-19T00:00:00.000Z")
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "ISRO",
      company: "Indian Space Research Organisation",
      location: "India",
      sourceUrl: "https://www.isro.gov.in/careers/istrac-02-2026.html",
    });
    expect(jobs[0].closesAt?.toISOString()).toBe("2026-07-31T23:59:59.999Z");
    expect(jobs[0].metadata?.advertisementNumber).toContain("ISTRAC:02:2026");
  });

  it("rejects expired recruitment notices and non-opening status updates", () => {
    const html = `
      <article>
        <h3>Recruitment of Technician B</h3>
        <p>Last Date to Apply: 08-07-2026</p>
        <a href="/expired">Apply online</a>
      </article>
      <article>
        <h3>Interview Schedule for Scientist Engineer</h3>
        <a href="/interview">Read more</a>
      </article>
    `;
    expect(
      parseOfficialGovernmentJobs(
        html,
        source,
        new Date("2026-07-19T00:00:00.000Z")
      )
    ).toEqual([]);
  });

  it("only parses deadlines when an explicit deadline label is present", () => {
    expect(extractGovernmentDeadline("Advt dated 17.07.2026")).toBeUndefined();
    expect(
      extractGovernmentDeadline("Application closes on 22 Jul 2026")?.toISOString()
    ).toBe("2026-07-22T23:59:59.999Z");
    expect(
      extractGovernmentDeadline("Start Date 22/06/2026 End Date 21/07/2026")
        ?.toISOString()
    ).toBe("2026-07-21T23:59:59.999Z");
  });

  it("rejects stale undated openings on freshness-limited sources", () => {
    const rbi = OFFICIAL_GOVERNMENT_SOURCES.find((item) => item.source === "RBI")!;
    const html = `
      <article>
        <h3>Recruitment of Assistant</h3>
        <p>Date: May 20, 2026</p>
        <a href="/Scripts/old-opening.aspx">View details</a>
      </article>
      <article>
        <h3>Recruitment of Site Engineers</h3>
        <p>Date: Jul 08, 2026</p>
        <a href="/Scripts/current-opening.aspx">View details</a>
      </article>
    `;
    const jobs = parseOfficialGovernmentJobs(
      html,
      rbi,
      new Date("2026-07-19T00:00:00.000Z")
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toContain("Site Engineers");
  });

  it("normalizes same-host official links to HTTPS and rejects status notices", () => {
    const drdo = OFFICIAL_GOVERNMENT_SOURCES.find(
      (item) => item.source === "DRDO"
    )!;
    const html = `
      <article>
        <h3>Recruitment of Apprentices</h3>
        <p>Published Date Jul 10, 2026</p>
        <a href="http://www.drdo.gov.in/drdo/opening">Apply</a>
      </article>
      <article>
        <h3>Provisionally Selected Candidates for Apprentice Recruitment</h3>
        <p>Published Date Jul 11, 2026</p>
        <a href="/drdo/results">View details</a>
      </article>
    `;
    const jobs = parseOfficialGovernmentJobs(
      html,
      drdo,
      new Date("2026-07-19T00:00:00.000Z")
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].sourceUrl).toBe("https://www.drdo.gov.in/drdo/opening");
  });
});
