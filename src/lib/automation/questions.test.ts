import { describe, expect, it } from "vitest";
import {
  answerCommonQuestions,
  buildKnownFieldAnswers,
} from "./questions";
import type {
  ApplicationProfile,
  BrowserAutomationClient,
  BrowserSnapshot,
} from "@/lib/browser/types";

const profile: ApplicationProfile = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  experienceYears: 5,
  visaSponsorshipRequired: false,
  willingToRelocate: true,
  noticePeriodDays: 14,
  salaryMin: 120000,
  salaryMax: 150000,
  salaryCurrency: "USD",
  workModes: ["REMOTE"],
};

describe("buildKnownFieldAnswers", () => {
  it("only emits values grounded in the profile", () => {
    const answers = buildKnownFieldAnswers(profile);
    const byKey = Object.fromEntries(answers.map((a) => [a.key, a.value]));

    expect(byKey.years_experience).toBe("5");
    expect(byKey.sponsorship).toBe("No");
    expect(byKey.relocation).toBe("Yes");
    expect(byKey.remote).toBe("Yes");
    expect(byKey.notice_period).toBe("14 days");
    expect(byKey.salary_expectation).toContain("120000");
  });

  it("leaves unknown facts unanswered instead of inventing them", () => {
    const answers = buildKnownFieldAnswers({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
    });
    const byKey = Object.fromEntries(answers.map((a) => [a.key, a.value]));

    expect(byKey.years_experience).toBeNull();
    expect(byKey.sponsorship).toBeNull();
    expect(byKey.relocation).toBeNull();
    expect(byKey.notice_period).toBeNull();
    expect(byKey.salary_expectation).toBeNull();
  });
});

describe("answerCommonQuestions", () => {
  it("fills known fields and reports inventable gaps", async () => {
    const typed: string[] = [];
    const snap: BrowserSnapshot = {
      url: "https://example.com/apply",
      title: "Apply",
      elements: [
        {
          ref: "e1",
          role: "textbox",
          name: "Years of experience",
          tag: "input",
        },
        {
          ref: "e2",
          role: "textbox",
          name: "Are you legally authorized to work in the US?",
          tag: "input",
        },
      ],
    };

    const browser = {
      snapshot: async () => snap,
      type: async (ref: string, text: string) => {
        typed.push(`${ref}:${text}`);
      },
      select: async () => undefined,
    } as unknown as BrowserAutomationClient;

    const result = await answerCommonQuestions(browser, profile);
    expect(typed).toEqual(["e1:5"]);
    expect(result.answered).toContain("years_experience");
    expect(result.unanswered).toContain("work_authorization");
  });
});
