import { describe, expect, it } from "vitest";
import {
  APPLICATION_ANSWER_DEFINITION_MAP,
  normalizeAnswerValue,
} from "./answer-bank";

describe("application answer bank policy", () => {
  it("marks legal and government eligibility answers as sensitive", () => {
    for (const key of [
      "work_authorization",
      "sponsorship",
      "government_category",
      "government_eligibility",
    ]) {
      expect(APPLICATION_ANSWER_DEFINITION_MAP.get(key)).toMatchObject({
        sensitive: true,
        legalOrEligibility: true,
      });
    }
  });

  it("accepts only explicit yes/no values for boolean application answers", () => {
    const definition = APPLICATION_ANSWER_DEFINITION_MAP.get("sponsorship")!;
    expect(normalizeAnswerValue(definition, "Yes")).toBe("Yes");
    expect(() => normalizeAnswerValue(definition, "Probably")).toThrow(
      "Choose Yes or No"
    );
  });

  it("does not accept blank answers", () => {
    const definition = APPLICATION_ANSWER_DEFINITION_MAP.get("notice_period")!;
    expect(() => normalizeAnswerValue(definition, " ")).toThrow(
      "Answer is required"
    );
  });
});
