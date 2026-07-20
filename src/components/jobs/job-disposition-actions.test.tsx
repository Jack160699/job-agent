import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDispositionActions } from "./job-disposition-actions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("JobDispositionActions", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("shows Saved from the successful response without waiting for a refresh", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job: { id: "job-123" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(
      <JobDispositionActions jobId="job-123" saved={false} excluded={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await expect(
      screen.findByRole("button", { name: "Saved" })
    ).resolves.toBeVisible();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
