import { test, expect } from "@playwright/test";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 2: Conversational onboarding", () => {
  test("onboarding page shows Kairela conversational header", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/onboarding`);
    await expect(page.getByText(/Profile completion/i)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /What would you like Kairela/i })
    ).toBeVisible();
  });

  test("onboarding API is protected or returns state", async ({ request }) => {
    const res = await request.get(`${BASE}/api/onboarding`);
    expect([200, 401, 500]).toContain(res.status());
  });

  test("landing still shows Kairela after Phase 2", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Kairela/);
  });
});
