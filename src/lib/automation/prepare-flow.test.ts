import { describe, expect, it, vi } from "vitest";
import type { BrowserAutomationClient } from "@/lib/browser/types";
import {
  detectRestrictedHandoff,
  prepareApplicationForm,
} from "./prepare-flow";

function browserWith(elements: Array<{
  ref: string;
  role: string;
  name: string;
  tag?: string;
}>) {
  const click = vi.fn(async () => undefined);
  const browser = {
    navigate: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async () => undefined),
    snapshot: vi.fn(async () => ({ elements })),
    click,
    type: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    select: vi.fn(async () => undefined),
    upload: vi.fn(async () => undefined),
  } as unknown as BrowserAutomationClient;
  return { browser, click };
}

const profile = {
  fullName: "Jane Applicant",
  email: "jane@example.com",
  phone: "5550100",
};

describe("grounded application preparation", () => {
  it("defaults to review and never clicks submit", async () => {
    const { browser, click } = browserWith([
      { ref: "apply", role: "button", name: "Apply for this job" },
      { ref: "first", role: "textbox", name: "First Name" },
      { ref: "last", role: "textbox", name: "Last Name" },
      { ref: "email", role: "textbox", name: "Email" },
      { ref: "submit", role: "button", name: "Submit Application" },
    ]);
    const result = await prepareApplicationForm({
      browser,
      jobUrl: "https://example.com/jobs/1",
      platform: "GENERIC_ATS",
      profile,
      documents: { resumeText: "Grounded resume", coverLetterText: "Letter" },
    });
    expect(result.status).toBe("pending_review");
    expect(click).toHaveBeenCalledWith("apply");
    expect(click).not.toHaveBeenCalledWith("submit");
  });

  it("returns missing information instead of guessing legal answers", async () => {
    const { browser, click } = browserWith([
      { ref: "apply", role: "button", name: "Apply" },
      { ref: "auth", role: "select", name: "Authorized to work?" },
      { ref: "submit", role: "button", name: "Submit Application" },
    ]);
    const result = await prepareApplicationForm({
      browser,
      jobUrl: "https://example.com/jobs/1",
      platform: "GENERIC_ATS",
      profile,
      documents: { resumeText: "Grounded resume", coverLetterText: "Letter" },
      autoSubmit: true,
    });
    expect(result.status).toBe("requires_manual");
    expect(result.message).toContain("will not invent");
    expect(click).not.toHaveBeenCalledWith("submit");
  });

  it("detects CAPTCHA and login handoffs without bypassing them", () => {
    expect(
      detectRestrictedHandoff({
        elements: [{ name: "Complete reCAPTCHA", role: "iframe" }],
      })
    ).toContain("CAPTCHA");
    expect(
      detectRestrictedHandoff({
        elements: [{ name: "Sign in to continue", role: "button" }],
      })
    ).toContain("Login");
  });
});
