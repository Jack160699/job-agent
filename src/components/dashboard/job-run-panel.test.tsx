import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobRunPanel } from "./job-run-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("JobRunPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a Cancel search button while a search is running, and calls DELETE on click", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((url, init) => {
      const u = String(url);
      if (u.includes("/api/jobs/progress")) {
        return jsonResponse({ progress: null });
      }
      if (u.includes("/api/jobs/search") && init?.method === "DELETE") {
        return jsonResponse({ cancelled: true, message: "Search cancelled." });
      }
      if (u.includes("/api/jobs/search")) {
        return jsonResponse({ queued: true });
      }
      return jsonResponse({});
    });

    render(<JobRunPanel mode="search" />);
    fireEvent.click(screen.getByRole("button", { name: /Run Job Search/i }));

    const cancelButton = await screen.findByRole("button", { name: /Cancel search/i });
    fireEvent.click(cancelButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/jobs/search", { method: "DELETE" })
    );
  });

  it("shows a differentiated zero-result state with broaden and edit-preferences actions", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/api/jobs/progress")) {
        return jsonResponse({ progress: null });
      }
      if (u.includes("/api/jobs/search")) {
        return jsonResponse({ queued: false, total: 0, new: 0 });
      }
      return jsonResponse({});
    });

    render(<JobRunPanel mode="search" />);
    fireEvent.click(screen.getByRole("button", { name: /Run Job Search/i }));

    expect(
      await screen.findByText(/No jobs matched your current preferences/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Broaden search/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit preferences/i })).toHaveAttribute(
      "href",
      "/dashboard/settings"
    );
  });

  it("shows diagnostics when jobs were fetched but every result was filtered out", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((url, init) => {
      const u = String(url);
      if (u.includes("/api/jobs/progress")) {
        return jsonResponse({ progress: null });
      }
      if (u.includes("/api/jobs/search")) {
        if (String(init?.body ?? "").includes('"source":"LINKEDIN"')) {
          return jsonResponse({
            queued: true,
            jobId: "retry-job",
            retrySource: "LINKEDIN",
          });
        }
        return jsonResponse({
          queued: false,
          total: 42,
          relevant: 0,
          new: 0,
          excluded: 42,
          filterImpact: { location_mismatch: 40, salary_below_minimum: 2 },
          zeroResultDiagnosis: {
            explanation: [
              "We found 42 jobs, but none passed your filters. The largest reason was outside your preferred locations (40 jobs).",
            ],
            suggestedActions: ["include_remote", "reduce_salary_minimum"],
          },
          sources: [
            {
              source: "LINKEDIN",
              success: false,
              error: "authentication_required",
            },
          ],
        });
      }
      return jsonResponse({});
    });

    render(<JobRunPanel mode="search" />);
    fireEvent.click(screen.getByRole("button", { name: /Run Job Search/i }));

    expect(await screen.findByText(/We found 42 jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/location mismatch: 40/i)).toBeInTheDocument();
    expect(screen.getByText(/LINKEDIN: unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/42 relevant jobs/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Retry this source/i })
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs/search?async=true",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "LINKEDIN" }),
        })
      )
    );
  });

  it("broadening lowers the match threshold and adds remote, then re-runs the search", async () => {
    const fetchMock = vi.mocked(fetch);
    let putBody: Record<string, unknown> | null = null;
    fetchMock.mockImplementation((url, init) => {
      const u = String(url);
      if (u.includes("/api/jobs/progress")) {
        return jsonResponse({ progress: null });
      }
      if (u === "/api/preferences" && (!init || init.method === undefined)) {
        return jsonResponse({
          settings: { matchThreshold: 70, workModes: ["ONSITE"] },
        });
      }
      if (u === "/api/preferences" && init?.method === "PUT") {
        putBody = JSON.parse(String(init.body));
        return jsonResponse({ settings: putBody });
      }
      if (u.includes("/api/jobs/search")) {
        return jsonResponse({ queued: false, total: 0, new: 0 });
      }
      return jsonResponse({});
    });

    render(<JobRunPanel mode="search" />);
    fireEvent.click(screen.getByRole("button", { name: /Run Job Search/i }));

    const broadenButton = await screen.findByRole("button", { name: /Broaden search/i });
    fireEvent.click(broadenButton);

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toMatchObject({ matchThreshold: 55, workModes: ["ONSITE", "REMOTE"] });
  });
});
