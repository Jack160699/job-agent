import { describe, expect, it } from "vitest";
import {
  normalizeProfileDate,
  splitCandidateLocation,
} from "./normalized-profile";

describe("normalized candidate profile helpers", () => {
  it("normalizes supported resume date formats without inventing a day", () => {
    expect(normalizeProfileDate("2024")).toBe("2024-01-01");
    expect(normalizeProfileDate("2024-06")).toBe("2024-06-01");
    expect(normalizeProfileDate("Jan 2023")).toBe("2023-01-01");
    expect(normalizeProfileDate("Present")).toBeNull();
    expect(normalizeProfileDate("ambiguous date")).toBeNull();
  });

  it("splits common Indian city and state input conservatively", () => {
    expect(splitCandidateLocation("Pune, Maharashtra")).toEqual({
      city: "Pune",
      state: "Maharashtra",
      country: "India",
    });
    expect(splitCandidateLocation("Bengaluru, Karnataka, India")).toEqual({
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
    });
  });
});
