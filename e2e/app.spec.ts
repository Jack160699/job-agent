import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "intelligent automation"
    );
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible();
  });
});

test.describe("Auth Pages", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("jobagent.test.2026@gmail.com");
    await page.getByLabel("Password").fill("TestPass123!Secure");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("dashboard overview renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Overview" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Run AI Agent/i })).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.getByRole("link", { name: "Job Search" }).click();
    await page.waitForURL(/\/dashboard\/jobs/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard\/jobs/);
  });
});

test.describe("API Health", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });
});
