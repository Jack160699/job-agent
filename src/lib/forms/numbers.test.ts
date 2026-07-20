import { describe, expect, it } from "vitest";
import { parseNumberOrFallback, parseOptionalInteger } from "./numbers";

describe("form number parsing", () => {
  it("preserves zero as a valid optional integer", () => {
    expect(parseOptionalInteger("0")).toBe(0);
  });

  it("returns null for an empty or invalid optional integer", () => {
    expect(parseOptionalInteger("")).toBeNull();
    expect(parseOptionalInteger("not-a-number")).toBeNull();
    expect(parseOptionalInteger("1.5")).toBeNull();
  });

  it("preserves a zero value instead of replacing it with the fallback", () => {
    expect(parseNumberOrFallback("0", 70)).toBe(0);
    expect(parseNumberOrFallback("", 70)).toBe(70);
  });
});
