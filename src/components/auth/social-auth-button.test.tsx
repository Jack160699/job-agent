import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/analytics/events", () => ({ trackAuthEvent: vi.fn() }));

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;

describe("SocialAuthButton", () => {
  beforeEach(() => {
    vi.resetModules();
    signInWithOAuth.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;
    else process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = ORIGINAL_FLAG;
    vi.resetModules();
  });

  it("hides the LinkedIn button when the flag is false", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "false";
    const { SocialAuthButton } = await import("./social-auth-button");
    render(<SocialAuthButton provider="linkedin_oidc" />);
    expect(screen.queryByRole("button", { name: /LinkedIn/i })).not.toBeInTheDocument();
  });

  it("shows the LinkedIn button when the flag is true", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    const { SocialAuthButton } = await import("./social-auth-button");
    render(<SocialAuthButton provider="linkedin_oidc" />);
    expect(screen.getByRole("button", { name: "Continue with LinkedIn" })).toBeInTheDocument();
  });

  it("always shows Google regardless of the LinkedIn flag", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "false";
    const { SocialAuthButton } = await import("./social-auth-button");
    render(<SocialAuthButton provider="google" />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("initiates sign-in with provider exactly \"linkedin_oidc\" and a safe internal redirect", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    const { SocialAuthButton } = await import("./social-auth-button");
    render(<SocialAuthButton provider="linkedin_oidc" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with LinkedIn" }));

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const call = signInWithOAuth.mock.calls[0][0];
    expect(call.provider).toBe("linkedin_oidc");
    expect(call.options.redirectTo).toMatch(
      /^https?:\/\/[^/]+\/auth\/callback\?next=\/dashboard&provider=linkedin_oidc$/
    );
  });

  it("requests provider exactly \"google\" for the Google button", async () => {
    const { SocialAuthButton } = await import("./social-auth-button");
    render(<SocialAuthButton provider="google" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth.mock.calls[0][0].provider).toBe("google");
  });
});
