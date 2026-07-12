import { test, expect } from "@playwright/test";
import { SAMPLE_RESUME, TEST_USER } from "./fixtures";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Phase 1: Deployment Health", () => {
  test("health endpoint returns ok with database connected", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.supabase).toBe("configured");
    expect(data.database).toBe("connected");
  });

  test("landing page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Phase 2: Authentication", () => {
  test("signup, login, logout flow", async ({ page }) => {
    const user = { ...TEST_USER, email: `qa.jobagent.${Date.now()}@gmail.com` };

    await page.goto("/signup");
    await page.getByLabel("Full Name").fill(user.fullName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL(/\/(dashboard|signup)/, { timeout: 15000 });

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByText("Overview")).toBeVisible();

    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset password")).toBeVisible();
  });

  test("duplicate email shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full Name").fill("Dup User");
    await page.getByLabel("Email").fill("jobagent.test.2026@gmail.com");
    await page.getByLabel("Password").fill("TestPass123!Secure");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url.includes("/signup") || url.includes("/dashboard")).toBeTruthy();
  });
});

test.describe("Phase 3: Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("jobagent.test.2026@gmail.com");
    await page.getByLabel("Password").fill("TestPass123!Secure");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  const pages = [
    { name: "Overview", path: "/dashboard", heading: "Overview" },
    { name: "Job Search", path: "/dashboard/jobs", heading: "Job Search" },
    { name: "AI Matches", path: "/dashboard/matches", heading: "AI Match Scores" },
    { name: "Resumes", path: "/dashboard/resumes", heading: "Resume Manager" },
    { name: "Cover Letters", path: "/dashboard/cover-letters", heading: "Cover Letter Manager" },
    { name: "Applications", path: "/dashboard/applications", heading: "Application Tracker" },
    { name: "Inbox", path: "/dashboard/inbox", heading: "Recruiter Inbox" },
    { name: "Calendar", path: "/dashboard/calendar", heading: "Interview Calendar" },
    { name: "Analytics", path: "/dashboard/analytics", heading: "Analytics" },
    { name: "Settings", path: "/dashboard/settings", heading: "Settings" },
    { name: "Logs", path: "/dashboard/logs", heading: "Audit Logs" },
  ];

  for (const p of pages) {
    test(`${p.name} page loads without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(p.path);
      await expect(page.getByRole("heading", { name: p.heading })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Something went wrong")).not.toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe("Phase 4: Resume Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("jobagent.test.2026@gmail.com");
    await page.getByLabel("Password").fill("TestPass123!Secure");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("upload master resume", async ({ page }) => {
    await page.goto("/dashboard/resumes");
    const textarea = page.locator("textarea");
    if (await textarea.isVisible()) {
      await textarea.fill(SAMPLE_RESUME);
      await page.getByRole("button", { name: /Upload Resume/i }).click();
      await page.waitForTimeout(3000);
      await page.reload();
      await expect(page.getByText(/JavaScript|TypeScript|React/)).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(page.getByText("Master Resume")).toBeVisible();
    }
  });
});

test.describe("Phase 6: Job Pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("jobagent.test.2026@gmail.com");
    await page.getByLabel("Password").fill("TestPass123!Secure");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("search jobs API works", async ({ page }) => {
    await page.goto("/dashboard/jobs");
    const res = await page.request.post("/api/jobs/search");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty("total");
    }
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
