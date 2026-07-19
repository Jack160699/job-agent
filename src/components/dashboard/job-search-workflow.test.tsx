import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores zero-result diagnostics instead of showing a false success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
      });
    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.click(
      screen.getByRole("button", { name: /Retry this source/i })
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs/search?async=true",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "BEL" }),
        })
      )
    );
  });

  it("pauses and resumes the persisted search through the real control API", async () => {
    let status = "running";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === "/api/jobs/search" && init?.method === "PATCH") {
        const action = JSON.parse(String(init.body)).action as "pause" | "resume";
        status = action === "pause" ? "paused" : "running";
        return {
          ok: true,
          json: async () =>
            action === "pause"
              ? { paused: true, message: "Search paused." }
              : { resumed: true, jobId: "search-1", message: "Search resumed." },
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          progress: {
            jobId: "search-1",
            status,
            stage: status,
            stageLabel: status === "paused" ? "Paused" : "Searching sources",
            progress: 40,
            jobsFound: 3,
            jobsNew: 2,
            jobsRelevant: 2,
            jobsExcluded: 1,
            queuePosition: null,
            error: null,
            stalled: false,
            completedAt: null,
            claimedAt: "2026-07-19T00:00:00.000Z",
          },
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<JobSearchWorkflow preferencesComplete />);
    fireEvent.click(await screen.findByRole("button", { name: /^Pause$/i }));

    expect(
      await screen.findByText(/Search paused\. Results already saved/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Resume$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs/search",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "resume" }),
        })
      )
    );
  });
});
