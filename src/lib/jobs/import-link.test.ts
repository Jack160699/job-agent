import { describe, it, expect } from "vitest";
import {
  JobImportError,
  extractFromHtml,
  normalizeJobUrl,
} from "@/lib/jobs/import-link";

describe("normalizeJobUrl", () => {
  it("normalizes public job URLs and strips tracking params", () => {
    const url = normalizeJobUrl(
      "https://Boards.GREENHOUSE.IO/Acme/jobs/123?utm_source=linkedin&fbclid=abc#apply"
    );
    expect(url.hostname).toBe("boards.greenhouse.io");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(url.toString()).toBe("https://boards.greenhouse.io/Acme/jobs/123");
  });

  it("rejects unsupported protocols", () => {
    expect(() => normalizeJobUrl("ftp://example.com/jobs/1")).toThrow(JobImportError);
    expect(() => normalizeJobUrl("not-a-url")).toThrow(JobImportError);
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeJobUrl("https://user:pass@example.com/jobs/1")).toThrow(
      JobImportError
    );
  });
});

describe("extractFromHtml", () => {
  it("extracts structured job data from JSON-LD", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Senior Product Designer",
              "description": "<p>Lead product design across mobile and web experiences for millions of users. You will partner with engineering, research, and product leadership.</p>",
              "datePosted": "2026-07-01",
              "employmentType": "FULL_TIME",
              "jobLocationType": "TELECOMMUTE",
              "hiringOrganization": { "@type": "Organization", "name": "Acme Labs" },
              "skills": "Figma, Design Systems, Prototyping"
            }
          </script>
        </head>
        <body><h1>Fallback title</h1></body>
      </html>`;

    const extracted = extractFromHtml(
      html,
      new URL("https://boards.greenhouse.io/acme/jobs/123")
    );

    expect(extracted.title).toBe("Senior Product Designer");
    expect(extracted.company).toBe("Acme Labs");
    expect(extracted.source).toBe("GREENHOUSE");
    expect(extracted.workMode).toBe("REMOTE");
    expect(extracted.employmentType).toBe("FULL_TIME");
    expect(extracted.extractionMethod).toBe("json_ld");
    expect(extracted.skills).toEqual(
      expect.arrayContaining(["Figma", "Design Systems", "Prototyping"])
    );
    expect(extracted.description.length).toBeGreaterThanOrEqual(80);
  });

  it("falls back to visible HTML when JSON-LD is missing", () => {
    const description =
      "We are hiring a backend engineer to build reliable APIs, improve observability, and ship production services with care.";
    const html = `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Backend Engineer" />
          <meta property="og:site_name" content="Northwind" />
        </head>
        <body>
          <main>
            <h1>Backend Engineer</h1>
            <div class="job-description">${description}</div>
          </main>
        </body>
      </html>`;

    const extracted = extractFromHtml(
      html,
      new URL("https://careers.northwind.example/jobs/backend-engineer")
    );

    expect(extracted.title).toBe("Backend Engineer");
    expect(extracted.company).toBe("Northwind");
    expect(extracted.source).toBe("COMPANY_PORTAL");
    expect(extracted.extractionMethod).toBe("html");
    expect(extracted.description).toContain("backend engineer");
  });

  it("requires enough content to verify the posting", () => {
    const html = `<html><body><h1>Role</h1><p>Too short.</p></body></html>`;
    expect(() =>
      extractFromHtml(html, new URL("https://careers.example.com/jobs/1"))
    ).toThrow(JobImportError);
  });
});
