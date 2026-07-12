import { test, expect } from "@playwright/test";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 4: Queue reliability", () => {
  test("health includes queue stats", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.queue).toBeDefined();
  });

  test("admin queue API requires auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/queue`);
    expect(res.status()).toBe(403);
  });
});
