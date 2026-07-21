import { describe, expect, it } from "vitest";
import { z } from "zod";

const sectorSchema = z.enum(["PRIVATE", "GOVERNMENT", "BOTH"]);

describe("settings sector preference contract", () => {
  it("accepts government sector preference values", () => {
    expect(sectorSchema.parse("GOVERNMENT")).toBe("GOVERNMENT");
    expect(sectorSchema.parse("BOTH")).toBe("BOTH");
    expect(sectorSchema.parse("PRIVATE")).toBe("PRIVATE");
  });

  it("rejects unsupported sector preference values", () => {
    expect(() => sectorSchema.parse("PUBLIC")).toThrow();
  });
});
