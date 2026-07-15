import { expect, test } from "@playwright/test";

test.describe("WS10 authentication and Google boundaries", () => {
  test("email login, Google login, and password recovery are reachable", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();

    await page.goto("/forgot-password");
    await expect(
      page.getByRole("button", { name: "Send Reset Link" })
    ).toBeVisible();

    await page.goto("/reset-password");
    await expect(
      page.getByRole("button", { name: "Update password" })
    ).toBeVisible();
  });

  test("Google Workspace connect and status APIs fail closed", async ({
    request,
  }) => {
    const connect = await request.get("/api/google/oauth?scopes=gmail");
    const status = await request.get("/api/google/status");
    const sync = await request.post("/api/google/status", {
      data: { action: "sync", gmail: true },
    });
    expect(connect.ok()).toBe(false);
    expect(status.ok()).toBe(false);
    expect(sync.ok()).toBe(false);
  });

  test("tampered Workspace OAuth state is rejected", async ({ page }) => {
    await page.goto("/api/google/callback?code=fake&state=tampered");
    await expect(page).toHaveURL(/google=error&reason=invalid_state_/);
  });
});
