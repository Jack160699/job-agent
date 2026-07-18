import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("resolveKairelaUser concurrent-first-request race", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("recovers by re-reading the winner's row instead of surfacing a P2002 unique-constraint error", async () => {
    // Reproduces a real bug found via live Preview verification: two
    // near-simultaneous first requests for a brand-new session (e.g. a
    // client router prefetch racing the real navigation) can both decide
    // "create_new" before either INSERT commits. The loser used to let the
    // P2002 error propagate, which getDbUser() silently swallowed into
    // `null` — making the onboarding redirect gate a no-op and stranding
    // new users on an empty, un-onboarded dashboard.
    const winnerRow = {
      id: "winner-id",
      supabaseId: "sb-race-1",
      email: "race@example.com",
      fullName: null,
      avatarUrl: null,
    };

    const findUnique = vi
      .fn()
      // resolveKairelaUser's own initial lookups: no existing row yet.
      .mockResolvedValueOnce(null) // existingBySupabaseId
      .mockResolvedValueOnce(null) // existingByEmail
      // Recovery lookup after the P2002: the concurrent winner's row.
      .mockResolvedValueOnce(winnerRow);
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
        code: "P2002",
      })
    );

    vi.doMock("@/lib/db", () => ({
      default: { user: { findUnique, create } },
      prisma: { user: { findUnique, create } },
    }));
    vi.doMock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));

    const { resolveKairelaUser } = await import("./resolve-user");

    const authUser = fakeUser({
      id: "sb-race-1",
      email: "race@example.com",
      email_confirmed_at: "2026-01-01",
    });

    const result = await resolveKairelaUser(authUser);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.user).toEqual(winnerRow);
      expect(result.created).toBe(false);
    }
    expect(create).toHaveBeenCalledTimes(1);
  });
});
