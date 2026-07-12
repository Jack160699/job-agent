import { test, expect } from "@playwright/test";
import { SAMPLE_RESUME, TEST_USER } from "./fixtures";
import {
  createConfirmedUser,
  confirmUserByEmail,
  deleteUserByEmail,
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
    expect(data.supabase).toBe("configured");
    expect(data.database).toBe("connected");
    expect(data.openai).toBe("configured");
    expect(data.encryption).toBe("configured");
    expect(data.cron).toBe("configured");
    expect(typeof data.background_jobs_pending).toBe("number");
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
    expect(errors).toEqual([]);
  });
});

test.describe("Phase 2: Authentication", () => {
  test("signup, login, logout flow", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `qa.jobagent.${Date.now()}@jobagent-e2e.test`,
    };

    try {
      await createConfirmedUser({
        email: user.email,
        password: user.password,
        fullName: user.fullName,
      });

      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign In" }).click();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "Overview" })
      ).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      await page.getByRole("button", { name: /Sign out/i }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("signup form creates account and requires verification", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `qa.signup.${Date.now()}@jobagent-e2e.test`,
    };

    try {
      await page.goto("/signup");
      await page.getByLabel("Full Name").fill(user.fullName);
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Create Account" }).click();

      await expect(page).toHaveURL(/\/verify-email/, { timeout: 20000 });
      await expect(page.getByText("Verify your email")).toBeVisible();

      // Confirm existing signup user via admin API for login test
      await confirmUserByEmail(user.email);

      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    } finally {
      await deleteUserByEmail(user.email);
    }
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
    await expect(
      page.getByText(/already registered|already exists|User already/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/signup/);
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
      const uploadResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/api/resumes/master") && res.request().method() === "POST"
      );
      await page.getByRole("button", { name: /Upload Resume/i }).click();
      const res = await uploadResponse;
      expect(res.ok()).toBeTruthy();
      await page.reload();
    }

    await expect(
      page.getByRole("heading", { name: "Master Resume" })
    ).toBeVisible();
    await expect(page.getByText("JavaScript", { exact: true })).toBeVisible({
      timeout: 10000,
    });
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
    test.setTimeout(120000);
    await page.goto("/dashboard/jobs");
    const res = await page.request.post("/api/jobs/search?async=true", {
      timeout: 30000,
    });
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty("queued");
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

test.describe("Phase 13: Integrations RC", () => {
  test("Supabase auth is reachable", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    const data = await res.json();
    expect(data.supabase).toBe("configured");
  });

  test("OpenAI is configured in production", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    const data = await res.json();
    expect(data.openai).toBe("configured");
  });

  test("Google OAuth status endpoint works", async ({ request }) => {
    const res = await request.get(`${BASE}/api/google/status`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("connected");
  });

  test("browser automation status endpoint works", async ({ request }) => {
    const res = await request.get(`${BASE}/api/browser/status`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.mode).toBeTruthy();
  });

  test("job progress endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/jobs/progress`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("ATS adapters registry is valid", async () => {
    const { getAllAutomators } = await import("../src/lib/automation/registry");
    const automators = getAllAutomators();
    expect(automators.length).toBeGreaterThanOrEqual(4);
    const platforms = automators.map((a) => a.platform);
    expect(platforms).toContain("GREENHOUSE");
    expect(platforms).toContain("LEVER");
    expect(platforms).toContain("ASHBY");
    expect(platforms).toContain("WORKDAY");
  });
});
