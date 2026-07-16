import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("SOCIAL_PROVIDERS LinkedIn flag gating", () => {
  const originalValue = process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalValue === undefined) delete process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;
    else process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = originalValue;
    vi.resetModules();
  });

  it("is disabled when the flag is missing", async () => {
    delete process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;
    const { SOCIAL_PROVIDERS } = await import("./social-providers");
    expect(SOCIAL_PROVIDERS.linkedin_oidc.enabled).toBe(false);
  });

  it("is disabled when the flag is explicitly false", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "false";
    const { SOCIAL_PROVIDERS } = await import("./social-providers");
    expect(SOCIAL_PROVIDERS.linkedin_oidc.enabled).toBe(false);
  });

  it("is enabled only when the flag is exactly \"true\"", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    const { SOCIAL_PROVIDERS } = await import("./social-providers");
    expect(SOCIAL_PROVIDERS.linkedin_oidc.enabled).toBe(true);
  });

  it("never gates Google behind the LinkedIn flag", async () => {
    delete process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED;
    const { SOCIAL_PROVIDERS } = await import("./social-providers");
    expect(SOCIAL_PROVIDERS.google.enabled).toBe(true);
  });
});

describe("isSocialProviderId", () => {
  it("recognizes exactly the two supported providers", async () => {
    const { isSocialProviderId } = await import("./social-providers");
    expect(isSocialProviderId("google")).toBe(true);
    expect(isSocialProviderId("linkedin_oidc")).toBe(true);
    expect(isSocialProviderId("facebook")).toBe(false);
  });
});
