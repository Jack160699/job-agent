import { describe, expect, it } from "vitest";
import { hasUsableEmail, isSupabaseEmailVerified } from "./resolve-user";
import type { User as SupabaseUser } from "@supabase/supabase-js";

function fakeUser(overrides: Partial<SupabaseUser>): SupabaseUser {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as SupabaseUser;
}

describe("hasUsableEmail", () => {
  it("is false when LinkedIn returns no email at all", () => {
    expect(hasUsableEmail(fakeUser({ email: undefined }))).toBe(false);
  });

  it("is false for an empty/whitespace email", () => {
    expect(hasUsableEmail(fakeUser({ email: "   " }))).toBe(false);
  });

  it("is true for a normal email", () => {
    expect(hasUsableEmail(fakeUser({ email: "user@example.com" }))).toBe(true);
  });
});

describe("isSupabaseEmailVerified", () => {
  it("trusts Supabase's own email_confirmed_at as authoritative", () => {
    expect(
      isSupabaseEmailVerified(fakeUser({ email: "user@example.com", email_confirmed_at: "2026-01-01" }))
    ).toBe(true);
  });

  it("falls back to the identity's raw email_verified claim when Supabase hasn't set email_confirmed_at", () => {
    const user = fakeUser({
      email: "user@example.com",
      email_confirmed_at: undefined,
      identities: [
        {
          id: "id1",
          user_id: "u1",
          identity_id: "i1",
          provider: "linkedin_oidc",
          identity_data: { email: "user@example.com", email_verified: true },
        } as never,
      ],
    });
    expect(isSupabaseEmailVerified(user)).toBe(true);
  });

  it("is false when LinkedIn's email_verified claim is explicitly false", () => {
    const user = fakeUser({
      email: "user@example.com",
      email_confirmed_at: undefined,
      identities: [
        {
          id: "id1",
          user_id: "u1",
          identity_id: "i1",
          provider: "linkedin_oidc",
          identity_data: { email: "user@example.com", email_verified: false },
        } as never,
      ],
    });
    expect(isSupabaseEmailVerified(user)).toBe(false);
  });

  it("is false with no confirmation signal at all", () => {
    expect(isSupabaseEmailVerified(fakeUser({ email: "user@example.com" }))).toBe(false);
  });
});
