import { describe, expect, it } from "vitest";
import { decideUserResolution } from "./user-resolution-policy";

describe("decideUserResolution", () => {
  it("uses the existing Prisma user when matched by Supabase id (repeated login stays idempotent)", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: true,
      hasUsableEmail: true,
      existingByEmail: true,
      emailVerified: true,
    });
    expect(decision).toEqual({ action: "use_existing_by_id" });
  });

  it("routes to email completion when the provider returned no usable email", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: false,
      hasUsableEmail: false,
      existingByEmail: false,
      emailVerified: false,
    });
    expect(decision).toEqual({ action: "email_missing" });
  });

  it("links to the existing account when the email matches and is verified (no duplicate created)", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: false,
      hasUsableEmail: true,
      existingByEmail: true,
      emailVerified: true,
    });
    expect(decision).toEqual({ action: "link_by_verified_email" });
  });

  it("refuses to link on an unverified email match, preventing insecure account merging", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: false,
      hasUsableEmail: true,
      existingByEmail: true,
      emailVerified: false,
    });
    expect(decision).toEqual({ action: "unverified_email_conflict" });
  });

  it("creates a brand-new user when nothing matches", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: false,
      hasUsableEmail: true,
      existingByEmail: false,
      emailVerified: true,
    });
    expect(decision).toEqual({ action: "create_new" });
  });

  it("prefers the Supabase-id match over any email signal (covers repeated LinkedIn logins)", () => {
    const decision = decideUserResolution({
      hasExistingBySupabaseId: true,
      hasUsableEmail: false,
      existingByEmail: false,
      emailVerified: false,
    });
    expect(decision).toEqual({ action: "use_existing_by_id" });
  });
});
