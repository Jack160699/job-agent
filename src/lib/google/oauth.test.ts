import { describe, expect, it } from "vitest";
import {
  assessGoogleConnectionHealth,
  GOOGLE_INTEGRATION_SCOPES,
  isGoogleReconnectError,
  mergeGoogleTokens,
  parseGoogleFeatures,
  unionGoogleFeatures,
} from "./oauth";

describe("Google OAuth helpers", () => {
  it("rejects unknown feature names", () => {
    expect(() => parseGoogleFeatures(["gmail", "spreadsheets"])).toThrow(
      /Invalid Google integration features/
    );
  });

  it("preserves an existing refresh token when exchange omits one", () => {
    const merged = mergeGoogleTokens(
      {
        access_token: "old-access",
        refresh_token: "keep-me",
        expiry_date: 1,
      },
      {
        access_token: "new-access",
        expiry_date: 2,
      }
    );

    expect(merged.refresh_token).toBe("keep-me");
    expect(merged.access_token).toBe("new-access");
  });

  it("unions granted features across incremental connects", () => {
    expect(unionGoogleFeatures(["gmail"], ["drive", "gmail"])).toEqual([
      "gmail",
      "drive",
    ]);
  });

  it("detects missing refresh tokens", () => {
    expect(
      assessGoogleConnectionHealth({
        access_token: "only-access",
      })
    ).toBe("missing_refresh_token");
  });

  it("requests least-privilege product scopes separately from identity", () => {
    expect(GOOGLE_INTEGRATION_SCOPES.gmail).toEqual([
      "https://www.googleapis.com/auth/gmail.readonly",
    ]);
    expect(GOOGLE_INTEGRATION_SCOPES.gmail).not.toContain("openid");
    expect(GOOGLE_INTEGRATION_SCOPES.drive).not.toEqual(
      GOOGLE_INTEGRATION_SCOPES.sheets
    );
  });

  it("marks an expired access-only connection for reconnect", () => {
    expect(
      assessGoogleConnectionHealth({
        access_token: "expired",
        expiry_date: Date.now() - 1,
      })
    ).toBe("expired");
    expect(isGoogleReconnectError(new Error("invalid_grant"))).toBe(true);
  });
});
