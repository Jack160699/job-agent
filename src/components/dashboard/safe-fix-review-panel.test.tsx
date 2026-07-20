import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SafeFixReviewPanel } from "./safe-fix-review-panel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const review = {
  version: "safe-fix-review-v1",
  sessionId: "session-1",
  actions: [],
  fixes: [
    {
      id: "fix-1",
      resumeVersion: 1,
      section: "Experience",
      originalContent: "Led  onboarding",
      proposedContent: "Led onboarding",
      category: "WHITESPACE",
      explanation: "Normalize whitespace.",
      riskLevel: "LOW",
      sourceEvidence: "Led  onboarding",
      deterministicValidation: { safe: true, reason: "Only whitespace changes." },
      requiresConfirmation: false,
      status: "PENDING",
      acceptedAt: null,
      rejectedAt: null,
      userId: "user-1",
      actionId: null,
    },
  ],
};

describe("SafeFixReviewPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ review }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: {
              ...review,
              fixes: [{ ...review.fixes[0], status: "ACCEPTED" }],
            },
            changedContent: true,
          }),
        })
    );
  });

  it("shows comparison evidence and accepts a fix", async () => {
    render(<SafeFixReviewPanel resumeId="resume-1" />);
    expect(await screen.findByText("Original")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getAllByText("Led onboarding").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: "Accept fix" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/resumes/resume-1/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "ACCEPT",
          fixId: "fix-1",
          confirmed: false,
        }),
      })
    );
  });
});
