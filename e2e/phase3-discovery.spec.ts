import { test, expect } from "@playwright/test";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 3: Preference-aware discovery", () => {
  test("health endpoint still ok", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  test("jobs page loads for unauthenticated redirect", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/jobs`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
