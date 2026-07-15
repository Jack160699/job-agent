import { describe, expect, it } from "vitest";
import {
  postAuthDestination,
  shouldRedirectAuthenticatedAuthPage,
} from "./redirect-policy";

describe("authentication redirect policy", () => {
  it("always preserves the password recovery destination", () => {
    expect(
      postAuthDestination({
        next: "/reset-password",
        onboardingComplete: false,
      })
    ).toBe("/reset-password");
    expect(shouldRedirectAuthenticatedAuthPage("/reset-password")).toBe(false);
  });

  it("keeps normal first-time sign-ins in onboarding", () => {
    expect(
      postAuthDestination({ next: "/dashboard", onboardingComplete: false })
    ).toBe("/dashboard/onboarding");
  });

  it("redirects signed-in users away from ordinary auth pages", () => {
    expect(shouldRedirectAuthenticatedAuthPage("/login")).toBe(true);
    expect(shouldRedirectAuthenticatedAuthPage("/signup")).toBe(true);
    expect(shouldRedirectAuthenticatedAuthPage("/auth/callback")).toBe(false);
  });
});
