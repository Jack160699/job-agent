import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResumeHistory, type ResumeHistoryEntry } from "./resume-history";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const orphanedTailored: ResumeHistoryEntry = {
  key: "tailored-current-1",
  id: "00000000-0000-0000-0000-000000000001",
  documentType: "TAILORED",
  isCurrent: true,
  version: 2,
  title: "Backend Resume",
  rawText: "TypeScript engineer",
  createdAt: "2026-07-15T10:00:00.000Z",
  status: "CURRENT",
  sourceMaster: {
    title: "Master Resume",
    version: 3,
    removed: true,
    rawText: "TypeScript engineer",
  },
  groundingReport: {
    acceptedCount: 4,
    gaps: ["Kubernetes"],
    claims: [
      {
        category: "skill",
        claim: "TypeScript",
        sourceResume: "Master Resume",
        sourceSection: "Skills",
        sourceExcerpt: "TypeScript engineer",
        state: "SOURCE_CONFIRMED",
        userConfirmed: false,
        aiImproved: false,
        reviewRequired: false,
      },
    ],
    excluded: [
      {
        category: "skill",
        claim: "Kubernetes",
        reasonCode: "NOT_IN_MASTER",
      },
    ],
  },
  application: { id: "app-1", status: "PENDING_REVIEW" },
  downloadUrl:
    "/api/resumes/00000000-0000-0000-0000-000000000001/pdf",
};

describe("ResumeHistory", () => {
  it("shows a safe orphan label and keeps owner actions available", () => {
    render(<ResumeHistory entries={[orphanedTailored]} />);
    expect(
      screen.getByText("Original master resume was removed.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PDF" })).toHaveAttribute(
      "href",
      orphanedTailored.downloadUrl
    );
    expect(screen.getByRole("button", { name: /Open/i })).toBeEnabled();
    expect(screen.queryByRole("link", { name: /master/i })).not.toBeInTheDocument();
  });

  it("surfaces grounding exclusions without internal paths", () => {
    render(<ResumeHistory entries={[orphanedTailored]} />);
    expect(
      screen.getByText("1 proposed change(s) excluded by grounding.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/file:\/\//i)).not.toBeInTheDocument();
  });

  it("shows claim-to-source evidence in the resume inspector", () => {
    render(<ResumeHistory entries={[orphanedTailored]} />);
    fireEvent.click(screen.getByRole("button", { name: /Open/i }));

    expect(screen.getByText("Claim-to-source inspector")).toBeInTheDocument();
    expect(screen.getByText("Source confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("TypeScript engineer").length).toBeGreaterThan(0);
    expect(screen.getByText(/User confirmed: Not yet/i)).toBeInTheDocument();
  });
});
