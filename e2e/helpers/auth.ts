import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
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
  if (!user) return;

  await admin.auth.admin.deleteUser(user.id);
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
