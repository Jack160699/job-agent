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
          title: query || "Senior Software Engineer",
          company: board,
          description: "Synthetic",
        },
      ],
    },
  ],
}));

import { GreenhouseAdapter } from "./adapters";

describe("search-plan adapter consumption", () => {
  it("passes only the title to ATS search and keeps location in diagnostics", async () => {
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
    expect(jobs[0]?.title).toBe("Senior Software Engineer");
    expect(jobs[0]?.title).not.toContain("San Francisco");
    expect(jobs[0]?.metadata).toMatchObject({
      requestedLocation: "Pune",
      remoteScope: "INDIA",
      searchStage: "strict",
      searchQuery: "Software Engineer",
    });
  });
});
