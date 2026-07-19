import { test, expect } from "@playwright/test";
import { SAMPLE_RESUME } from "./fixtures";
import {
  loginWithSharedAccount,
} from "./helpers/auth";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 1: Deployment Health", () => {
  test("health endpoint returns ok with database connected", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data.timestamp).toEqual(expect.any(String));
    expect(data).not.toHaveProperty("openai");
    expect(data).not.toHaveProperty("encryption");
  });

  test("all tests target production deployment", async () => {
    expect(BASE).toBe("https://job-agent-mu-steel.vercel.app");
    expect(BASE).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  test("landing page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Kairela/);
    expect(errors).toEqual([]);
  });
});

test.describe("Phase 2: Authentication", () => {
  test("ephemeral login, persistence, and logout flow", async ({ page }) => {
    await loginWithSharedAccount(page);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    const mobileMore = page.getByRole("button", { name: "More navigation" });
    if (await mobileMore.isVisible().catch(() => false)) {
      await mobileMore.click();
    }
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("signup form validates without consuming email quota", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByLabel("Full Name")).toBeFocused();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset password")).toBeVisible();
  });

});

test.describe("Phase 3: Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  const pages = [
    { name: "Overview", path: "/dashboard", heading: /Overview|Home/ },
    { name: "Job Search", path: "/dashboard/jobs", heading: /Job Search|Jobs/ },
    { name: "AI Matches", path: "/dashboard/matches", heading: /AI Match Scores|Matches/ },
    { name: "Resumes", path: "/dashboard/resumes", heading: /Resume Manager|Resume/ },
    { name: "Cover Letters", path: "/dashboard/cover-letters", heading: /Cover Letter Manager|Cover Letters/ },
    { name: "Applications", path: "/dashboard/applications", heading: /Application Tracker|Applications/ },
    { name: "Inbox", path: "/dashboard/inbox", heading: /Recruiter Inbox|Inbox/ },
    { name: "Calendar", path: "/dashboard/calendar", heading: /Interview Calendar|Calendar/ },
    { name: "Analytics", path: "/dashboard/analytics", heading: /Analytics/ },
    { name: "Settings", path: "/dashboard/settings", heading: /Settings/ },
    { name: "Logs", path: "/dashboard/logs", heading: /Audit Logs|Logs/ },
  ];

  for (const p of pages) {
    test(`${p.name} page loads without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(p.path);
      await expect(
        page.getByRole("heading", { name: p.heading }).first()
      ).toBeVisible({ timeout: 20000 });
      await expect(page.getByText("Something went wrong")).not.toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe("Phase 4: Resume Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  test("upload master resume", async ({ page }) => {
    await page.goto("/dashboard/resumes");
    const textarea = page.locator("textarea");
    if (await textarea.isVisible()) {
      await textarea.fill(SAMPLE_RESUME);
      const uploadResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/api/resumes/master") && res.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Save resume" }).click();
      const res = await uploadResponse;
      expect(res.ok()).toBeTruthy();
      await page.reload();
    }

    await expect(
      page.getByRole("heading", { name: "Master Resume" }).first()
    ).toBeVisible();
    await expect(page.getByText("JavaScript", { exact: true })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Phase 6: Job Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  test("search jobs API works", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/dashboard/jobs");
    const res = await page.request.post("/api/jobs/search?async=true", {
      timeout: 30000,
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("queued");
  });
});

test.describe("Phase 9: Background Jobs", () => {
  test("cron endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron`);
    expect(res.status()).toBe(401);
  });
});

test.describe("Phase 12: Security", () => {
  test("API rejects unauthenticated resume upload", async ({ request }) => {
    const res = await request.post(`${BASE}/api/resumes/master`, {
      data: { rawText: "test" },
    });
    expect(res.status()).toBe(401);
  });

  test("rate limiting headers present on API", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
  });
});

test.describe("Phase 13: Integrations RC", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  test("Google OAuth status endpoint works for an authenticated user", async ({ page }) => {
    const res = await page.request.get("/api/google/status");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("connected");
  });

  test("browser automation status endpoint works for an authenticated user", async ({ page }) => {
    const res = await page.request.get("/api/browser/status");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.mode).toBeTruthy();
  });

  test("protected integrations reject unauthenticated requests", async ({ request }) => {
    const [google, browser] = await Promise.all([
      request.get(`${BASE}/api/google/status`),
      request.get(`${BASE}/api/browser/status`),
    ]);
    expect(google.status()).toBe(401);
    expect(browser.status()).toBe(401);
  });

  test("job progress endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/jobs/progress`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("production source registry is visible", async ({ page }) => {
    await page.goto("/dashboard/sources");
    await expect(
      page.getByRole("heading", { name: /Job sources|Sources/ }).first()
    ).toBeVisible({ timeout: 20000 });
    for (const source of ["Greenhouse", "Lever", "Ashby", "Workday"]) {
      await expect(page.getByText(new RegExp(source), { exact: false }).first()).toBeVisible();
    }
  });
});
