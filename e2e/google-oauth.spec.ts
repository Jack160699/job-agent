import { test, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail } from "./helpers/auth";

test.describe("Google OAuth Integrations", () => {
  test("settings shows Connect when Google is not linked", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `google.oauth.${Date.now()}@jobagent-e2e.test`,
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

      await page.goto("/dashboard/settings");
      await page.getByRole("tab", { name: "Integrations" }).click();

      await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
      await expect(page.getByText("Connected", { exact: true })).not.toBeVisible();
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("settings shows Connected and enables toggles after OAuth callback", async ({
    page,
  }) => {
    const user = {
      ...TEST_USER,
      email: `google.connected.${Date.now()}@jobagent-e2e.test`,
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

      await page.route("**/api/google/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            connected: true,
            email: "connected.user@gmail.com",
            integrations: {
              gmail: true,
              drive: true,
              sheets: true,
              calendar: true,
            },
          }),
        });
      });

      await page.goto("/dashboard/settings?google=connected");
      await page.getByRole("tab", { name: "Integrations" }).click();

      await expect(page.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Connected as connected.user@gmail.com")).toBeVisible();

      await page.screenshot({
        path: "test-results/google-integrations-connected.png",
        fullPage: true,
      });

      const integrationsPanel = page.getByRole("tabpanel");
      const gmailCheckbox = integrationsPanel.getByRole("checkbox").nth(0);
      const driveCheckbox = integrationsPanel.getByRole("checkbox").nth(1);
      const sheetsCheckbox = integrationsPanel.getByRole("checkbox").nth(2);
      const calendarCheckbox = integrationsPanel.getByRole("checkbox").nth(3);

      await expect(gmailCheckbox).toBeChecked();
      await expect(driveCheckbox).toBeChecked();
      await expect(sheetsCheckbox).toBeChecked();
      await expect(calendarCheckbox).toBeChecked();
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("google status API returns disconnected for unauthenticated requests", async ({
    request,
  }) => {
    const res = await request.get("/api/google/status");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.connected).toBe(false);
  });
});
