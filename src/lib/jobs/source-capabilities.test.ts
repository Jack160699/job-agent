import { describe, expect, it } from "vitest";
import {
  SOURCE_CAPABILITIES,
  unavailableEnabledSources,
} from "./source-capabilities";

describe("job source capabilities", () => {
  it("does not claim commercial search works without permitted access", () => {
    expect(SOURCE_CAPABILITIES.LINKEDIN).toMatchObject({
      searchable: false,
      status: "authentication_required",
    });
    expect(SOURCE_CAPABILITIES.NAUKRI).toMatchObject({
      searchable: false,
      status: "authentication_required",
    });
  });

  it("returns enabled sources that the live adapter set cannot search", () => {
    expect(
      unavailableEnabledSources(
        ["LINKEDIN", "GREENHOUSE", "NAUKRI"],
        ["GREENHOUSE"]
      ).map((source) => source.source)
    ).toEqual(["LINKEDIN", "NAUKRI"]);
  });
});
