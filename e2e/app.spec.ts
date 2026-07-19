import { test, expect } from "@playwright/test";
import { loginWithSharedAccount } from "./helpers/auth";

test.describe("Landing Page", () => {
  test("renders hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Your career, managed by Kairela."
    );
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Log in/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start free/i }).first()).toBeVisible();
  });

  test("has feature and pricing sections", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /One connected journey, from uncertainty to momentum/i,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Start with clarity. Upgrade when it helps/i,
      })
    ).toBeVisible();
  });
});

test.describe("Auth Pages", () => {
  test("login page renders with Google auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("signup page renders with Google auth", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("verify email page renders", async ({ page }) => {
    await page.goto("/verify-email?email=test@example.com");
    await expect(page.getByText("Verify your email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Resend verification/i })).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  test("dashboard overview renders", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Run AI Agent/i })).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Jobs", exact: true }).click();
    await page.waitForURL(/\/dashboard\/jobs/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
  });

  test("job search page has run button", async ({ page }) => {
    await page.goto("/dashboard/jobs");
    await expect(page.getByRole("button", { name: /Run Job Search/i })).toBeVisible();
  });
});

test.describe("API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("jobs progress endpoint requires auth", async ({ request }) => {
    const response = await request.get("/api/jobs/progress");
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
