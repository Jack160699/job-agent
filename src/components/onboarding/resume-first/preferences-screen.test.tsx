import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreferencesScreen } from "./preferences-screen";
import type { OnboardingDraft } from "@/lib/onboarding/steps";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("PreferencesScreen safe defaults", () => {
  it("defaults to review-required on and auto-submit off", () => {
    const draft: OnboardingDraft = {
      fullName: "Ada Lovelace",
      currentLocation: "London, UK",
      currentRole: "Engineer",
      experienceYears: 5,
      requiredSkills: ["TypeScript"],
      jobTitles: ["Backend Engineer"],
    };
    render(<PreferencesScreen draft={draft} onCompleted={vi.fn()} />);

    const reviewToggle = screen.getByLabelText(/Review every application before it's submitted/i);
    const autoSubmitToggle = screen.getByLabelText(/Allow Kairela to auto-submit/i);
    expect(reviewToggle).toBeChecked();
    expect(autoSubmitToggle).not.toBeChecked();
  });

  it("only asks for fields the resume did not already answer", () => {
    const fullDraft: OnboardingDraft = {
      fullName: "Ada Lovelace",
      currentLocation: "London, UK",
      currentRole: "Engineer",
      experienceYears: 5,
      requiredSkills: ["TypeScript"],
      jobTitles: ["Backend Engineer"],
    };
    render(<PreferencesScreen draft={fullDraft} onCompleted={vi.fn()} />);
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current location")).not.toBeInTheDocument();
  });

  it("asks for baseline fields when the resume was skipped", () => {
    render(<PreferencesScreen draft={{}} onCompleted={vi.fn()} />);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Current location")).toBeInTheDocument();
    expect(screen.getByLabelText("Current role")).toBeInTheDocument();
  });
});
