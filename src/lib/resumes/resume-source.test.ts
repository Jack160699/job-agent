import { describe, expect, it } from "vitest";
import {
  createOriginalResumeSignedUrl,
  sha256Resume,
} from "./resume-source";

describe("resume source preservation", () => {
  it("uses deterministic SHA-256 content identities", () => {
    const bytes = new TextEncoder().encode("candidate resume content");
    expect(sha256Resume(bytes)).toBe(
      "cdf6c4f9aa80e833f36cb500a57b3c6c3f9e2567c079f5941757f286ccf84a30"
    );
    expect(sha256Resume(bytes)).toBe(sha256Resume(bytes));
  });

  it("rejects a storage path outside the authenticated user's folder", async () => {
    await expect(
      createOriginalResumeSignedUrl({
        userId: "owner-id",
        storagePath: "different-user/resume.pdf",
      })
    ).rejects.toThrow("ownership mismatch");
  });
});
