import { describe, expect, it } from "vitest";
import {
  isConfirmedRelevantClassification,
  isPotentialMatchClassification,
} from "@/lib/applications/answer-bank-service";

describe("match confidence buckets", () => {
  it("treats STRONG/POSSIBLE/LOW as confirmed relevant", () => {
    expect(isConfirmedRelevantClassification("STRONG")).toBe(true);
    expect(isConfirmedRelevantClassification("POSSIBLE")).toBe(true);
    expect(isConfirmedRelevantClassification("LOW")).toBe(true);
    expect(isConfirmedRelevantClassification("CONFIRMED_RELEVANT")).toBe(true);
  });

  it("separates potential matches from confirmed relevant", () => {
    expect(
      isPotentialMatchClassification("POTENTIAL_MATCH_REQUIRES_VERIFICATION")
    ).toBe(true);
    expect(
      isConfirmedRelevantClassification("POTENTIAL_MATCH_REQUIRES_VERIFICATION")
    ).toBe(false);
    expect(isPotentialMatchClassification("REJECTED")).toBe(false);
  });
});
