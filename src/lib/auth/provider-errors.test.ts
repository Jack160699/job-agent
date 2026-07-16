import { describe, expect, it } from "vitest";
import { classifyAuthError, providerAuthFailedMessage, sanitizeProviderParam } from "./provider-errors";

describe("sanitizeProviderParam", () => {
  it("accepts only known provider ids", () => {
    expect(sanitizeProviderParam("google")).toBe("google");
    expect(sanitizeProviderParam("linkedin_oidc")).toBe("linkedin_oidc");
    expect(sanitizeProviderParam("email")).toBe("email");
  });

  it("rejects anything else, including attempted injection", () => {
    expect(sanitizeProviderParam("facebook")).toBeNull();
    expect(sanitizeProviderParam("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeProviderParam(null)).toBeNull();
    expect(sanitizeProviderParam(undefined)).toBeNull();
  });
});

describe("providerAuthFailedMessage", () => {
  it("gives provider-specific copy for known providers", () => {
    expect(providerAuthFailedMessage("google")).toBe("Google authentication could not be completed.");
    expect(providerAuthFailedMessage("linkedin_oidc")).toBe(
      "LinkedIn authentication could not be completed."
    );
  });

  it("falls back to a generic message otherwise", () => {
    expect(providerAuthFailedMessage(null)).toBe("Authentication could not be completed.");
    expect(providerAuthFailedMessage("email")).toBe("Authentication could not be completed.");
  });
});

describe("classifyAuthError", () => {
  it("never returns the raw message — only a coarse category", () => {
    expect(classifyAuthError("token has expired at 2026-01-01T00:00:00Z")).toBe("expired");
    expect(classifyAuthError("access_denied: user cancelled")).toBe("access_denied");
    expect(classifyAuthError("invalid_grant")).toBe("invalid_grant");
    expect(classifyAuthError("network request failed")).toBe("network");
    expect(classifyAuthError("something completely unrecognized")).toBe("unknown");
    expect(classifyAuthError(null)).toBe("unknown");
  });
});
