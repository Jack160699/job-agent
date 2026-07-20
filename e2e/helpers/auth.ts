import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Shared production fixture account — credentials must come from env, never the repo. */
export function getSharedE2ECredentials() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for authenticated Playwright runs."
    );
  }
  return { email, password };
}

export async function loginWithSharedAccount(page: Page) {
  const { email, password } = getSharedE2ECredentials();
  if (process.env.VERCEL_SHARE_URL) {
    await page.goto(process.env.VERCEL_SHARE_URL);
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  // The post-login redirect is a client-side RSC transition through
  // middleware -> dashboard layout -> onboarding gate; on a cold Preview
  // lambda (no warm instances yet) this measurably takes well past 15s even
  // though the actual Supabase sign-in call itself returns in under 1s.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
}

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin credentials missing for E2E tests");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createConfirmedUser(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error) throw error;
  return data.user;
}

export async function confirmUserByEmail(email: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (updateError) throw updateError;
  return user.id;
}

export async function deleteUserByEmail(email: string) {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);

  // The application user table is intentionally separate from auth.users.
  // Remove it explicitly so all owner-scoped resume, onboarding, and job
  // records cascade during E2E cleanup instead of becoming orphaned fixtures.
  const { data: applicationUser, error: lookupError } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (applicationUser) {
    const { data: storedFiles, error: storageListError } = await admin.storage
      .from("resume-sources")
      .list(applicationUser.id, { limit: 1000 });
    if (storageListError) throw storageListError;
    const storagePaths = (storedFiles ?? [])
      .filter((file) => Boolean(file.id))
      .map((file) => `${applicationUser.id}/${file.name}`);
    if (storagePaths.length > 0) {
      const { error: storageDeleteError } = await admin.storage
        .from("resume-sources")
        .remove(storagePaths);
      if (storageDeleteError) throw storageDeleteError;
    }
  }
  const { error: applicationDeleteError } = applicationUser
    ? await admin.from("users").delete().eq("id", applicationUser.id)
    : { error: null };
  if (applicationDeleteError) throw applicationDeleteError;

  if (user) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw authDeleteError;
  }
}

export async function isSignupRateLimited(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `probe.${Date.now()}@jobagent-e2e.test`,
      password: "ProbePass123!Secure",
    }),
  });

  if (res.status !== 429) {
    const body = await res.json().catch(() => null);
    if (body?.user?.id) {
      await deleteUserByEmail(body.user.email);
    }
  }

  return res.status === 429;
}
