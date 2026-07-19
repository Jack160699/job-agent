import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import { StructuredResumeEditor } from "./structured-resume-editor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const field = <T,>(value: T) => ({
  value,
  confidence: 0.8,
  source: "resume",
  directlyFound: true,
  needsReview: false,
});

function profile(): ParsedCareerProfile {
  return {
    fullName: field("Aarav Sharma"),
    email: field("aarav@example.com"),
    phone: field("+91 98765 43210"),
    currentLocation: field("Pune, Maharashtra"),
    professionalSummary: field("Implementation analyst with SQL experience."),
    currentRole: field("Implementation Analyst"),
    jobTitles: field(["Implementation Analyst"]),
    experienceYears: field(2),
    skills: field(["SQL", "Jira"]),
    experience: field([]),
    education: field([]),
    projects: field([]),
    certifications: field([]),
    languages: field(["English"]),
    linkedinUrl: field(null),
    githubUrl: field(null),
    portfolioUrl: field(null),
    meta: {
      extractionMethod: "deterministic",
      generatedAt: "2026-07-19T00:00:00.000Z",
    },
  };
}

describe("StructuredResumeEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("autosaves structured changes and reports saved state", async () => {
    render(
      <StructuredResumeEditor
        profile={profile()}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Aarav S. Sharma" },
    });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/resumes/master/profile",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("Aarav S. Sharma"),
      })
    );
    expect(screen.getByText(/Saved \d/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("blocks saving invalid professional links and shows an error summary", () => {
    render(
      <StructuredResumeEditor
        profile={profile()}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("LinkedIn URL"), {
      target: { value: "not-a-url" },
    });

    expect(screen.getByText("Enter a valid LinkedIn URL.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save all" })).toBeDisabled();
  });
});
