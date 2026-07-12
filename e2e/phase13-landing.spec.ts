import { test, expect } from "@playwright/test";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 13: Landing and legal", () => {
  test("landing page loads with Kairela branding", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("text=Kairela").first()).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await expect(page.locator("h1")).toContainText("Privacy");
  });

  test("terms page loads", async ({ page }) => {
    await page.goto(`${BASE}/terms`);
    await expect(page.locator("h1")).toContainText("Terms");
  });
});
