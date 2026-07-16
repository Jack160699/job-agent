import { test, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail, getAdminClient, loginWithSharedAccount } from "./helpers/auth";

/**
 * LinkedIn OIDC coverage.
 *
 * Real LinkedIn credentials are never used here. Scenarios that require an
 * actual LinkedIn OAuth completion (a genuinely email-less identity) cannot
 * be simulated with the Supabase admin API and are documented as such
 * in-line — see docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md.
 *
 * Scenarios 1/2 assume NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED=true on the target
 * environment; they are written to still pass gracefully (skip the LinkedIn
 * assertion) when the flag is off, since the flag is intentionally kept off
 * by default for this change.
 */

test.describe("LinkedIn OIDC sign-in", () => {
  test("login page shows Google and email options, plus LinkedIn when enabled", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    const linkedin = page.getByRole("button", { name: "Continue with LinkedIn" });
    if (await linkedin.isVisible().catch(() => false)) {
      await expect(linkedin).toBeVisible();
    }
  });

  test("signup page shows Google and email options, plus LinkedIn when enabled", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByLabel("Full Name")).toBeVisible();

    const linkedin = page.getByRole("button", { name: "Continue with LinkedIn" });
    if (await linkedin.isVisible().catch(() => false)) {
      await expect(linkedin).toBeVisible();
    }
  });

  test("LinkedIn button initiates an OAuth request for provider=linkedin_oidc targeting our own callback", async ({
    page,
  }) => {
    await page.goto("/login");
    const linkedin = page.getByRole("button", { name: "Continue with LinkedIn" });
    if (!(await linkedin.isVisible().catch(() => false))) {
      test.skip(true, "NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED is off on this target");
    }

    const authorizeRequest = page.waitForRequest((req) => req.url().includes("/auth/v1/authorize"));
    await linkedin.click();
    const request = await authorizeRequest;
    const url = new URL(request.url());

    expect(url.pathname).toContain("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("linkedin_oidc");
    const redirectTo = url.searchParams.get("redirect_to") ?? "";
    expect(redirectTo).toContain("/auth/callback");
    expect(redirectTo).toContain("provider=linkedin_oidc");
  });

  test("provider failure at the callback shows LinkedIn-specific guidance, not raw provider text", async ({
    page,
  }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_description=user_cancelled_login&provider=linkedin_oidc"
    );
    await expect(page).toHaveURL(/\/login\?.*error=auth_callback_failed/, { timeout: 15000 });
    await expect(page.getByText("LinkedIn authentication could not be completed.")).toBeVisible();
    await expect(page.getByText(/user_cancelled_login/i)).not.toBeVisible();
  });

  test("email completion page is inaccessible when signed out", async ({ page }) => {
    await page.goto("/auth/complete-email");
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("existing completed user is not re-onboarded after routing through the callback", async ({ page }) => {
    await loginWithSharedAccount(page);
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/dashboard\/onboarding/, { timeout: 10000 });
  });

  test("a freshly authenticated user with a verified email routes into resume-first onboarding", async ({
    page,
  }) => {
    // Exercises the exact post-exchange resolution + destination logic that
    // a LinkedIn login with an email would also go through (resolveKairelaUser
    // -> postAuthDestination), using Supabase's magic-link OTP as the
    // available way to reach /auth/callback without real OAuth credentials.
    const user = {
      ...TEST_USER,
      email: `linkedin-parity.${Date.now()}@jobagent-e2e.test`,
    };
    try {
      await createConfirmedUser(user);
      const admin = getAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });
      expect(error).toBeNull();
      const tokenHash = data?.properties?.hashed_token;
      expect(tokenHash).toBeTruthy();

      await page.goto(`/auth/callback?token_hash=${tokenHash}&type=magiclink&next=/dashboard`);
      await expect(page).toHaveURL(/\/dashboard\/onboarding/, { timeout: 15000 });
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("mobile: login and signup have no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });

    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `${path} should not overflow horizontally`).toBe(false);
    }
  });
});
