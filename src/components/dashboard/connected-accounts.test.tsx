import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserIdentities = vi.fn();
const linkIdentity = vi.fn();
const unlinkIdentity = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUserIdentities, linkIdentity, unlinkIdentity },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics/events", () => ({ trackAuthEvent: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

async function importFresh() {
  vi.resetModules();
  const mod = await import("./connected-accounts");
  return mod.ConnectedAccounts;
}

describe("ConnectedAccounts", () => {
  beforeEach(() => {
    getUserIdentities.mockReset();
    linkIdentity.mockReset();
    unlinkIdentity.mockReset();
  });

  it("shows Not connected for a provider with no identity", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    getUserIdentities.mockResolvedValue({ data: { identities: [{ id: "g1", provider: "google" }] }, error: null });
    const ConnectedAccounts = await importFresh();

    render(<ConnectedAccounts />);

    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());
    const linkedinRow = screen.getByText("LinkedIn").closest("div")!.parentElement!;
    expect(linkedinRow).toHaveTextContent("Not connected");
  });

  it("shows Connected for a provider with an existing identity", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          { id: "g1", provider: "google" },
          { id: "l1", provider: "linkedin_oidc" },
        ],
      },
      error: null,
    });
    const ConnectedAccounts = await importFresh();

    render(<ConnectedAccounts />);

    const linkedinRow = await screen.findByText("LinkedIn");
    expect(linkedinRow.closest("div")!.parentElement).toHaveTextContent("Connected");
  });

  it("hides the LinkedIn row entirely when the feature flag is off", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "false";
    getUserIdentities.mockResolvedValue({ data: { identities: [{ id: "g1", provider: "google" }] }, error: null });
    const ConnectedAccounts = await importFresh();

    render(<ConnectedAccounts />);

    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());
    expect(screen.queryByText("LinkedIn")).not.toBeInTheDocument();
  });

  it("disables disconnect when it is the user's only identity", async () => {
    process.env.NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED = "true";
    getUserIdentities.mockResolvedValue({
      data: { identities: [{ id: "l1", provider: "linkedin_oidc" }] },
      error: null,
    });
    const ConnectedAccounts = await importFresh();

    render(<ConnectedAccounts />);

    const disconnectButton = await screen.findByRole("button", { name: /Disconnect/i });
    expect(disconnectButton).toBeDisabled();
  });
});
