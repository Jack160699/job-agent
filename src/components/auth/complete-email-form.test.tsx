import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CompleteEmailForm } from "./complete-email-form";

const updateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics/events", () => ({ trackAuthEvent: vi.fn() }));

describe("CompleteEmailForm", () => {
  beforeEach(() => {
    updateUser.mockReset();
  });

  it("submits the entered email with a safe internal redirect target", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<CompleteEmailForm next="/dashboard" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    const [attrs, options] = updateUser.mock.calls[0];
    expect(attrs).toEqual({ email: "new@example.com" });
    expect(options.emailRedirectTo).toMatch(/\/auth\/callback\?next=%2Fdashboard$/);
  });

  it("shows a generic, non-enumerating error when Supabase rejects the email", async () => {
    updateUser.mockResolvedValue({ error: { message: "User already registered" } });
    render(<CompleteEmailForm next="/dashboard" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/already registered/i);
    expect(alert.textContent).toMatch(/try a different one/i);
  });

  it("shows a confirmation state after a successful email update request", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<CompleteEmailForm next="/dashboard" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    await screen.findByText(/We sent a confirmation link/i);
  });
});
