import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSignedOAuthState,
  isSafeInternalRedirect,
  verifySignedOAuthState,
} from "./oauth-state";

describe("oauth-state", () => {
  beforeEach(() => {
    process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret-min-32-chars!!";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts valid signed state", () => {
    const token = createSignedOAuthState({
      userId: "user-1",
      features: ["gmail"],
    });
    const result = verifySignedOAuthState(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.userId).toBe("user-1");
      expect(result.payload.features).toEqual(["gmail"]);
    }
  });

  it("rejects expired state", () => {
    const token = createSignedOAuthState({
      userId: "user-1",
      features: ["gmail"],
    });
    vi.advanceTimersByTime(11 * 60 * 1000);
    const result = verifySignedOAuthState(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects modified state", () => {
    const token = createSignedOAuthState({
      userId: "user-1",
      features: ["gmail"],
    });
    const [data] = token.split(".");
    const tampered = `${data}.invalid-signature`;
    const result = verifySignedOAuthState(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
  });

  it("rejects replayed state", () => {
    const token = createSignedOAuthState({
      userId: "user-1",
      features: ["gmail"],
    });
    expect(verifySignedOAuthState(token).ok).toBe(true);
    const replay = verifySignedOAuthState(token);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("replay");
  });

  it("rejects legacy unsigned state", () => {
    const legacy = Buffer.from(
      JSON.stringify({ userId: "victim", features: ["gmail"] })
    ).toString("base64url");
    const result = verifySignedOAuthState(legacy);
    expect(result.ok).toBe(false);
  });

  it("validates safe internal redirects", () => {
    expect(isSafeInternalRedirect("/dashboard")).toBe(true);
    expect(isSafeInternalRedirect("//evil.com")).toBe(false);
    expect(isSafeInternalRedirect("https://evil.com")).toBe(false);
    expect(isSafeInternalRedirect("/dashboard\\evil")).toBe(false);
  });
});
