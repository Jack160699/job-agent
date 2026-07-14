import { describe, expect, it } from "vitest";
import {
  classifyAutomationMessage,
  mapSubmissionToApplicationStatus,
} from "./automation-policy";

describe("application automation policy", () => {
  it("classifies login and captcha stop conditions", () => {
    expect(classifyAutomationMessage("Please sign in to continue")).toBe(
      "needs_login"
    );
    expect(classifyAutomationMessage("Complete the CAPTCHA challenge")).toBe(
      "captcha_required"
    );
  });

  it("never treats login or captcha blockers as successful submission", () => {
    expect(
      mapSubmissionToApplicationStatus(
        {
          success: false,
          status: "failed",
          message: "Login required before Apply",
        },
        true
      )
    ).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failureReason: "NEEDS_LOGIN",
      })
    );

    expect(
      mapSubmissionToApplicationStatus(
        {
          success: false,
          status: "failed",
          message: "CAPTCHA challenge blocked automation",
        },
        true
      )
    ).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failureReason: "CAPTCHA_REQUIRED",
      })
    );
  });

  it("keeps reviewable stops available for the user", () => {
    expect(
      mapSubmissionToApplicationStatus(
        {
          success: true,
          status: "pending_review",
          message: "Review required before final submit",
        },
        false
      ).status
    ).toBe("PENDING_REVIEW");
  });
});
