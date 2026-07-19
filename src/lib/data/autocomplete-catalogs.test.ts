import { describe, expect, it } from "vitest";
import { searchAutocompleteCatalog } from "./autocomplete-catalogs";

describe("autocomplete catalogs", () => {
  it("covers every requested structured profile catalog", () => {
    expect(searchAutocompleteCatalog("skills", "type")).toContain("TypeScript");
    expect(searchAutocompleteCatalog("degrees", "mca")).toContain("MCA");
    expect(searchAutocompleteCatalog("institutions", "technology").length).toBeGreaterThan(0);
    expect(searchAutocompleteCatalog("government_departments", "railway")).toContain(
      "Railway Recruitment Board"
    );
    expect(searchAutocompleteCatalog("public_sector_organizations", "ntpc")).toContain("NTPC");
    expect(searchAutocompleteCatalog("states", "maha")).toContain("Maharashtra");
  });

  it("returns an empty state for no match and caps large results", () => {
    expect(searchAutocompleteCatalog("skills", "zzzzzz")).toEqual([]);
    expect(searchAutocompleteCatalog("skills", "a", 3)).toHaveLength(3);
  });
});
