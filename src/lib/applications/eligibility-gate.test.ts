import { describe, expect, it } from "vitest";
import {
  assertApplicationReadyForDocuments,
  assertApplicationReadyForPreparation,
  isEligibilityVerified,
} from "./eligibility-gate";

describe("eligibility gate", () => {
  it("allows confirmed relevant jobs without verification", () => {
    expect(
      isEligibilityVerified({ classification: "STRONG" })
    ).toBe(true);
    expect(() =>
      assertApplicationReadyForDocuments({ classification: "POSSIBLE" })
    ).not.toThrow();
  });

  it("blocks potential matches until eligibility is verified", () => {
    expect(
      isEligibilityVerified({
        classification: "POTENTIAL_MATCH_REQUIRES_VERIFICATION",
      })
    ).toBe(false);
    expect(() =>
      assertApplicationReadyForPreparation({
        classification: "POTENTIAL_MATCH_REQUIRES_VERIFICATION",
      })
    ).toThrow("POTENTIAL_MATCH_REQUIRES_VERIFICATION");
  });

  it("allows potential matches after user verification", () => {
    expect(
      isEligibilityVerified({
        classification: "POTENTIAL_MATCH_REQUIRES_VERIFICATION",
        eligibilityVerified: true,
      })
    ).toBe(true);
    expect(() =>
      assertApplicationReadyForDocuments({
        classification: "POTENTIAL_MATCH_REQUIRES_VERIFICATION",
        eligibilityVerified: true,
      })
    ).not.toThrow();
  });
});
