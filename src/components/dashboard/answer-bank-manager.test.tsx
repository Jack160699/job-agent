import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerBankManager } from "./answer-bank-manager";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AnswerBankManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the authoritative saved answer without waiting for a refresh", async () => {
    let getCount = 0;
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              answer: {
                id: "answer-1",
                questionKey: "notice_period",
                questionLabel: "Notice period",
                answer: "30 days",
                isSensitive: false,
                isPrivate: true,
                confirmationState: "confirmed",
                confirmedAt: "2026-07-20T00:00:00.000Z",
                lastUsedAt: null,
                usageCount: 0,
                version: 1,
              },
            }),
          } as Response;
        }

        getCount += 1;
        if (getCount === 1) {
          return {
            ok: true,
            json: async () => ({ answers: [] }),
          } as Response;
        }

        return new Promise<Response>(() => {});
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AnswerBankManager />);
    expect(await screen.findByText(/No answers saved/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Application field"), {
      target: { value: "notice_period" },
    });
    fireEvent.change(screen.getByLabelText("Confirmed value"), {
      target: { value: "30 days" },
    });
    fireEvent.click(
      screen.getByLabelText("I confirm this value is accurate")
    );
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));

    expect(
      await screen.findByRole("heading", { name: "Notice period" })
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    await waitFor(() => expect(getCount).toBe(2));
  });
});
