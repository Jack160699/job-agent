import { describe, expect, it, vi } from "vitest";
import type { JobSearchFilters } from "./types";

vi.mock("@/lib/automation/registry", () => ({
  getAllAutomators: () => [
    {
      platform: "GREENHOUSE",
      discoverJobs: async (board: string, query: string) => [
        {
          externalId: `${board}-${query}`,
          source: "GREENHOUSE",
          sourceUrl: `https://boards.greenhouse.io/${board}/jobs/1`,
          title: query,
          company: board,
          description: "Synthetic",
        },
      ],
    },
  ],
}));

import { GreenhouseAdapter } from "./adapters";

describe("search-plan adapter consumption", () => {
  it("passes location-aware plan queries into discovery instead of titles alone", async () => {
    const adapter = new GreenhouseAdapter();
    const filters: JobSearchFilters = {
      titles: ["Software Engineer"],
      locations: ["Pune"],
      queries: [
        {
          title: "Software Engineer",
          location: "Pune",
          remoteScope: "INDIA",
          reasons: ["Primary target role", "Preferred location: Pune"],
        },
      ],
      discoveryBoards: { greenhouse: ["acme"] },
    };
    const jobs = await adapter.search(filters);
    expect(jobs[0]?.title).toBe("Software Engineer Pune");
    expect(jobs[0]?.title).not.toContain("San Francisco");
  });
});
