import { describe, expect, it } from "vitest";
import { validateSubmissionAuthorization } from "./action-policy";

describe("application submission authorization", () => {
  it("allows preparation without submission confirmation", () => {
    expect(
      validateSubmissionAuthorization({
        autoSubmit: false,
        confirmed: false,
      })
    ).toEqual({ allowed: true });
  });

  it("fails closed when submission is not confirmed", () => {
    expect(
      validateSubmissionAuthorization({
        autoSubmit: true,
        confirmed: false,
      })
    ).toEqual(
      expect.objectContaining({
        allowed: false,
        code: "SUBMISSION_CONFIRMATION_REQUIRED",
      })
    );
  });

  it("allows an explicitly confirmed submission", () => {
    expect(
      validateSubmissionAuthorization({
        autoSubmit: true,
        confirmed: true,
      })
    ).toEqual({ allowed: true });
  });
});
