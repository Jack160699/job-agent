import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createServer } from "http";
import { PlaywrightBrowserClient } from "../../src/lib/browser/client";
import { GreenhouseAutomator } from "../../src/lib/automation/greenhouse";
import { LeverAutomator } from "../../src/lib/automation/lever";
import { AshbyAutomator } from "../../src/lib/automation/ashby";
import { WorkdayAutomator } from "../../src/lib/automation/workday";
import { GenericAtsAutomator } from "../../src/lib/automation/generic";
import { getProductionBaseUrl } from "../helpers/production";

const FIXTURES = resolve(__dirname, "fixtures");
/** Local fixture server port — serves static HTML only, not the app under test. */
const FIXTURE_SERVER_PORT = 9876;

function fixtureRoute(path: string) {
  const html = readFileSync(resolve(FIXTURES, path), "utf8");
  return html;
}

let server: ReturnType<typeof createServer>;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const file = (req.url || "/greenhouse.html").replace(/^\//, "");
    try {
      const html = fixtureRoute(file);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(FIXTURE_SERVER_PORT, resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const profile = {
  fullName: "Jane Applicant",
  email: "jane.applicant@jobagent-e2e.test",
  phone: "555-0100",
  linkedinUrl: "https://linkedin.com/in/jane",
  location: "Remote",
};

const documents = {
  resumeText: "Jane Applicant\nSoftware Engineer with 5 years experience.\nSkills: TypeScript, React, Node.js",
  coverLetterText: "I am excited to apply for this role and contribute to your team.",
};

type ApplicantProfile = typeof profile;
type ApplicationDocuments = typeof documents;

async function runPlatformTest(
  file: string,
  AutomatorClass: new () => {
    prepareApplication: (
      browser: PlaywrightBrowserClient,
      jobUrl: string,
      profile: ApplicantProfile,
      documents: ApplicationDocuments,
      options?: { autoSubmit?: boolean }
    ) => Promise<{ success: boolean; status: string }>;
  }
) {
  const browser = new PlaywrightBrowserClient();
  try {
    const automator = new AutomatorClass();
    const result = await automator.prepareApplication(
      browser,
      `http://127.0.0.1:${FIXTURE_SERVER_PORT}/${file}`,
      profile,
      documents,
      { autoSubmit: false }
    );
    expect(["pending_review", "requires_manual"]).toContain(result.status);
    const shot = await browser.screenshot();
    expect(shot.length).toBeGreaterThan(1000);
    const { writeFileSync, mkdirSync } = await import("fs");
    const { resolve } = await import("path");
    const dir = resolve(__dirname, "../../test-results/browser-screenshots");
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${file.replace(".html", "")}-filled.png`), shot);
  } finally {
    await browser.close();
  }
}

test.describe("Platform Browser Automation", () => {
  test.setTimeout(120000);

  test("Greenhouse form fill", async () => {
    await runPlatformTest("greenhouse.html", GreenhouseAutomator);
  });

  test("Lever form fill", async () => {
    await runPlatformTest("lever.html", LeverAutomator);
  });

  test("Ashby form fill", async () => {
    await runPlatformTest("ashby.html", AshbyAutomator);
  });

  test("Workday form fill", async () => {
    await runPlatformTest("workday.html", WorkdayAutomator);
  });

  test("Generic ATS form fill is review-only", async () => {
    await runPlatformTest("generic.html", GenericAtsAutomator);
  });
});

test.describe("MCP Bridge API", () => {
  test("browser status endpoint responds", async ({ request }) => {
    const base = getProductionBaseUrl();
    const res = await request.get(`${base}/api/browser/status`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.mode).toBeTruthy();
  });
});
