import { test, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures";
import { deleteUserByEmail } from "./helpers/auth";

test.describe("Google Sign-In Auth", () => {
  test("login page shows Continue with Google button", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();
  });

  test("signup page shows Continue with Google button", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible();
  });

  test("unverified user is redirected to verify-email", async ({ page }) => {
    const user = {
      ...TEST_USER,
      email: `google.unverified.${Date.now()}@jobagent-e2e.test`,
    };

    try {
      // Create user WITHOUT email confirmation
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const admin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: false,
        user_metadata: { full_name: user.fullName },
      });

      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign In" }).click();

      await expect(page).toHaveURL(/\/verify-email/, { timeout: 15000 });
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});
