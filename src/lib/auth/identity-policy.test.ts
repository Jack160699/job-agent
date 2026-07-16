import { describe, expect, it } from "vitest";
import { canUnlinkIdentity } from "./identity-policy";

describe("canUnlinkIdentity", () => {
  it("blocks unlinking the only identity", () => {
    const decision = canUnlinkIdentity([{ provider: "linkedin_oidc" }], { provider: "linkedin_oidc" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/at least one other way/i);
  });

  it("allows unlinking when another identity remains", () => {
    const decision = canUnlinkIdentity(
      [{ provider: "google" }, { provider: "linkedin_oidc" }],
      { provider: "linkedin_oidc" }
    );
    expect(decision.allowed).toBe(true);
  });

  it("counts an email/password identity as a valid remaining sign-in method", () => {
    const decision = canUnlinkIdentity(
      [{ provider: "email" }, { provider: "linkedin_oidc" }],
      { provider: "linkedin_oidc" }
    );
    expect(decision.allowed).toBe(true);
  });

  it("blocks unlinking with zero identities (defensive)", () => {
    const decision = canUnlinkIdentity([], { provider: "linkedin_oidc" });
    expect(decision.allowed).toBe(false);
  });
});
