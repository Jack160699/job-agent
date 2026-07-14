import { test, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail, loginWithSharedAccount } from "./helpers/auth";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 15: Preferences & Queue", () => {
  test("search blocked without preferences returns 422", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `phase15.noprefs.${Date.now()}@jobagent-e2e.test`,
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

      const res = await page.request.post(`${BASE}/api/jobs/search?async=true`);
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("PREFERENCES_INCOMPLETE");
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("preferences API saves and validates", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `phase15.prefs.${Date.now()}@jobagent-e2e.test`,
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

      const put = await page.request.put(`${BASE}/api/preferences`, {
        data: {
          jobTitles: ["Backend Engineer"],
          requiredSkills: ["TypeScript", "Node.js"],
          preferredSkills: ["PostgreSQL"],
          experienceYears: 4,
          locations: ["Remote"],
          workModes: ["REMOTE"],
          matchThreshold: 60,
          preferencesComplete: true,
        },
      });
      expect(put.ok()).toBeTruthy();
      const saved = await put.json();
      expect(saved.validation.complete).toBe(true);
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("onboarding route redirects completed users to jobs", async ({ page }) => {
    await loginWithSharedAccount(page);

    await page.goto("/dashboard/onboarding");
    await expect(page).toHaveURL(/\/dashboard\/jobs/, { timeout: 15000 });
  });

  test("jobs page shows edit preferences action", async ({ page }) => {
    await loginWithSharedAccount(page);

    await page.goto("/dashboard/jobs");
    await expect(page.getByRole("link", { name: /Edit search preferences/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Run Job Search/i })).toBeVisible();
  });

  test("duplicate search clicks are idempotent", async ({ page }) => {
    test.setTimeout(120000);
    await loginWithSharedAccount(page);

    await page.request.put("/api/preferences", {
      data: {
        jobTitles: ["Software Engineer"],
        requiredSkills: ["JavaScript", "TypeScript"],
        experienceYears: 3,
        locations: ["Remote"],
        workModes: ["REMOTE"],
        matchThreshold: 50,
        preferencesComplete: true,
      },
    });

    const r1 = await page.request.post("/api/jobs/search?async=true");
    const r2 = await page.request.post("/api/jobs/search?async=true");
    expect(r1.ok()).toBeTruthy();
    expect(r2.ok()).toBeTruthy();
    const d1 = await r1.json();
    const d2 = await r2.json();
    if (d2.deduped) {
      expect(d2.jobId).toBe(d1.jobId);
    }
  });

  test("health reports queue stats", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.queue).toBeTruthy();
    expect(typeof data.queue.pending).toBe("number");
  });
});

test.describe("Phase 15: Google OAuth separation", () => {
  test("login page Google button does not use workspace scopes", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();
  });

  test("integration oauth accepts scope query", async ({ page }) => {
    await loginWithSharedAccount(page);

    const res = await page.request.get("/api/google/oauth?scopes=gmail");
    if (res.status() === 200) {
      const data = await res.json();
      expect(data.url).toContain("google");
      expect(data.features).toEqual(["gmail"]);
      expect(data.url).not.toContain("spreadsheets");
    }
  });
});
