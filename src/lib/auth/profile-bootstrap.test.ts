import { describe, expect, it } from "vitest";
import { extractBasicProfile, mergeProfileFillOnly } from "./profile-bootstrap";

describe("extractBasicProfile", () => {
  it("reads name/avatar from either Google- or LinkedIn-style metadata keys", () => {
    expect(extractBasicProfile({ full_name: "Ada Lovelace", avatar_url: "https://x/a.png" })).toEqual({
      fullName: "Ada Lovelace",
      avatarUrl: "https://x/a.png",
    });
    expect(extractBasicProfile({ name: "Grace Hopper", picture: "https://x/b.png" })).toEqual({
      fullName: "Grace Hopper",
      avatarUrl: "https://x/b.png",
    });
  });

  it("returns nulls rather than fabricating values when metadata is missing", () => {
    expect(extractBasicProfile(null)).toEqual({ fullName: null, avatarUrl: null });
    expect(extractBasicProfile({})).toEqual({ fullName: null, avatarUrl: null });
  });

  it("never produces any field beyond fullName/avatarUrl", () => {
    const result = extractBasicProfile({
      full_name: "Ada",
      avatar_url: "https://x/a.png",
      given_name: "Ada",
      family_name: "Lovelace",
      locale: "en-US",
      sub: "abc123",
      email: "ada@example.com",
    });
    expect(Object.keys(result).sort()).toEqual(["avatarUrl", "fullName"]);
  });
});

describe("mergeProfileFillOnly", () => {
  it("fills empty fields from the provider", () => {
    const patch = mergeProfileFillOnly(
      { fullName: null, avatarUrl: null },
      { fullName: "Ada Lovelace", avatarUrl: "https://x/a.png" }
    );
    expect(patch).toEqual({ fullName: "Ada Lovelace", avatarUrl: "https://x/a.png" });
  });

  it("never overwrites an existing (user-edited or resume-confirmed) value", () => {
    const patch = mergeProfileFillOnly(
      { fullName: "Confirmed Name", avatarUrl: "https://existing/avatar.png" },
      { fullName: "LinkedIn Name", avatarUrl: "https://linkedin/avatar.png" }
    );
    expect(patch).toEqual({});
  });

  it("fills only the empty one when only one field is missing", () => {
    const patch = mergeProfileFillOnly(
      { fullName: "Confirmed Name", avatarUrl: null },
      { fullName: "LinkedIn Name", avatarUrl: "https://linkedin/avatar.png" }
    );
    expect(patch).toEqual({ avatarUrl: "https://linkedin/avatar.png" });
  });

  it("treats whitespace-only existing values as empty", () => {
    const patch = mergeProfileFillOnly(
      { fullName: "   ", avatarUrl: undefined },
      { fullName: "LinkedIn Name", avatarUrl: "https://linkedin/avatar.png" }
    );
    expect(patch).toEqual({ fullName: "LinkedIn Name", avatarUrl: "https://linkedin/avatar.png" });
  });
});
