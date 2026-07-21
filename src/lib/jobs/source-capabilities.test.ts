import { describe, expect, it } from "vitest";
import {
  SOURCE_CAPABILITIES,
  getSourceCapabilities,
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

  it("separates public discovery from authenticated connection state", () => {
    expect(
      getSourceCapabilities({ SERPER_API_KEY: "configured" }).LINKEDIN
    ).toMatchObject({
      searchable: true,
      publicDiscoveryStatus: "available",
      publicDiscoveryProvider: "serper",
      authenticatedConnectionStatus: "connection_required",
      noEasyApplyClaim: true,
    });
    expect(
      getSourceCapabilities({ BRAVE_SEARCH_API_KEY: "configured" }).LINKEDIN
    ).toMatchObject({
      searchable: true,
      publicDiscoveryStatus: "available",
      publicDiscoveryProvider: "brave",
      authenticatedConnectionStatus: "connection_required",
    });
    expect(getSourceCapabilities({}).NAUKRI).toMatchObject({
      searchable: false,
      publicDiscoveryStatus: "setup_required",
      authenticatedConnectionStatus: "connection_required",
      importSupported: true,
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
