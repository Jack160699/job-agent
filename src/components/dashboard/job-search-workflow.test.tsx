import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobSearchWorkflow } from "./job-search-workflow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe("JobSearchWorkflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restores zero-result diagnostics instead of showing a false success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          progress: {
            jobId: "search-1",
            status: "completed",
            stage: "completed",
            stageLabel: "Complete",
            progress: 100,
            jobsFound: 42,
            jobsNew: 0,
            jobsRelevant: 0,
            jobsExcluded: 42,
            queuePosition: null,
            error: null,
            stalled: false,
            completedAt: "2026-07-19T00:00:00.000Z",
            claimedAt: "2026-07-19T00:00:00.000Z",
            failedSources: [
              { source: "BEL", error: "unavailable: TLS validation failed" },
            ],
            summary: "Found 42 raw roles, 0 relevant, 42 excluded.",
            result: {
              zeroResultDiagnosis: {
                explanation: [
                  "We found 42 jobs, but none passed your filters.",
                ],
              },
              filterImpact: { location_mismatch: 40 },
            },
          },
        }),
      })
    );

    render(
      <JobSearchWorkflow
        preferencesComplete
        lastSearchAt="just now"
        lastResultCount={0}
      />
    );

    expect(
      await screen.findByText(/no jobs passed your current filters/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We found 42 jobs, but none passed/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/BEL: unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/location mismatch: 40/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/42 relevant jobs found/i)
    ).not.toBeInTheDocument();
  });
});
