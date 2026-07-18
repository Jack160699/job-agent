import { describe, expect, it } from "vitest";
import { searchLocations, formatLocationLabel, ALL_LOCATIONS } from "./locations";

describe("searchLocations", () => {
  it('returns Bhilai, Bhind, and Bhiwandi for "BHI"', () => {
    const results = searchLocations("BHI").map((r) => r.city);
    expect(results).toEqual(expect.arrayContaining(["Bhilai", "Bhind", "Bhiwandi"]));
  });

  it("is case-insensitive", () => {
    const upper = searchLocations("MUM").map((r) => r.city);
    const lower = searchLocations("mum").map((r) => r.city);
    expect(upper).toEqual(lower);
    expect(upper).toContain("Mumbai");
  });

  it("prioritizes prefix matches over substring matches", () => {
    const results = searchLocations("Pun");
    expect(results[0].city).toBe("Pune");
  });

  it("returns an empty array for an empty query", () => {
    expect(searchLocations("")).toEqual([]);
  });

  it("respects the limit", () => {
    const results = searchLocations("a", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("has no duplicate city+state pairs", () => {
    const seen = new Set<string>();
    for (const loc of ALL_LOCATIONS) {
      const key = `${loc.city}|${loc.state}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("formats a label with state and country", () => {
    expect(formatLocationLabel({ city: "Pune", state: "Maharashtra", country: "India" })).toBe(
      "Pune, Maharashtra, India"
    );
    expect(formatLocationLabel({ city: "Singapore", state: "", country: "Singapore" })).toBe(
      "Singapore, Singapore"
    );
  });
});
