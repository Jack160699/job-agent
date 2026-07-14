import { test, expect } from "@playwright/test";
import { loginWithSharedAccount } from "./helpers/auth";

const PAGES = [
  { name: "landing", path: "/", heading: /Kairela manages your job search/ },
  { name: "login", path: "/login", heading: /Welcome back/ },
  { name: "signup", path: "/signup", heading: /Create your account/ },
];

test.describe("Visual Regression — Public Pages", () => {
  for (const p of PAGES) {
    test(`${p.name} screenshot`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.screenshot({
        path: `test-results/visual/${p.name}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("Visual Regression — Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithSharedAccount(page);
  });

  test("overview desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByText("Active Jobs").first()).toBeVisible();
    await page.screenshot({ path: "test-results/visual/dashboard-overview-desktop.png" });
  });

  test("overview mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText("Active Jobs").first()).toBeVisible();
    await page.screenshot({ path: "test-results/visual/dashboard-overview-mobile.png" });
  });

  test("jobs page mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard/jobs");
    await expect(page.getByRole("button", { name: /Run Job Search/i })).toBeVisible();
    await page.screenshot({ path: "test-results/visual/jobs-mobile.png" });
  });
});

test.describe("Visual Regression — Viewports", () => {
  const viewports = [
    { name: "iphone-se", width: 375, height: 667 },
    { name: "iphone-15", width: 393, height: 852 },
    { name: "pixel", width: 412, height: 915 },
    { name: "ipad", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
    { name: "ultrawide", width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`landing ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.screenshot({
        path: `test-results/visual/landing-${vp.name}.png`,
        fullPage: false,
      });
    });
  }
});
