import { test, expect } from "@playwright/test";
import { getProductionBaseUrl } from "./helpers/production";

const BASE = getProductionBaseUrl();

test.describe("Phase 1: Kairela brand", () => {
  test("landing page shows Kairela branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Kairela home/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Kairela/);
  });

  test("page title includes Kairela", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Kairela/);
  });

  test("login page shows Kairela branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Kairela home/i })).toBeVisible();
  });

  test("manifest is served", async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.name).toBe("Kairela");
    expect(data.short_name).toBe("Kairela");
  });

  test("robots.txt references sitemap", async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`);
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Sitemap:/i);
  });

  test("favicon SVG is available", async ({ request }) => {
    const res = await request.get(`${BASE}/icons/favicon.svg`);
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("<svg");
  });
});
