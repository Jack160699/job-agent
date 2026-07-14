import { describe, expect, it } from "vitest";
import {
  assessGoogleConnectionHealth,
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
});
