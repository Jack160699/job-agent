import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedSearchesPanel } from "./saved-searches-panel";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("SavedSearchesPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("saves the current search with a real daily alert schedule", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ search: { id: "saved-1" } }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ searches: [] }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SavedSearchesPanel preferencesComplete />);
    fireEvent.change(screen.getByLabelText("Saved search name"), {
      target: { value: "Pune healthcare" },
    });
    fireEvent.change(screen.getByLabelText("Alert frequency"), {
      target: { value: "DAILY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save search" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/saved-searches",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"alertFrequency":"DAILY"'),
        })
      )
    );
  });
});
