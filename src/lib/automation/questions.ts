import type { ApplicationProfile, BrowserAutomationClient } from "@/lib/browser/types";
import { findElementWithFallbacks } from "./resilient";

const COMMON_ANSWERS: Array<{
  patterns: RegExp[];
  answer: (profile: ApplicationProfile) => string;
}> = [
  {
    patterns: [/authorized to work/i, /legally authorized/i, /work authorization/i],
    answer: () => "Yes",
  },
  {
    patterns: [/sponsorship/i, /visa/i, /require sponsorship/i],
    answer: () => "No",
  },
  {
    patterns: [/years of experience/i, /how many years/i],
    answer: () => "3",
  },
  {
    patterns: [/willing to relocate/i, /open to relocation/i],
    answer: () => "Yes",
  },
  {
    patterns: [/remote/i, /work from home/i, /hybrid/i],
    answer: () => "Yes",
  },
  {
    patterns: [/salary expectation/i, /desired compensation/i, /expected salary/i],
    answer: () => "Negotiable based on total compensation",
  },
  {
    patterns: [/start date/i, /earliest start/i, /when can you start/i],
    answer: () => "2 weeks notice",
  },
  {
    patterns: [/gender/i, /race/i, /ethnicity/i, /veteran/i, /disability/i],
    answer: () => "Decline to self-identify",
  },
];

export async function answerCommonQuestions(
  browser: BrowserAutomationClient,
  profile: ApplicationProfile
) {
  const snap = await browser.snapshot();

  for (const item of COMMON_ANSWERS) {
    const field = findElementWithFallbacks(snap, item.patterns, [
      /select/i,
      /radio/i,
      /checkbox/i,
    ]);
    if (!field) continue;

    try {
      if (field.role === "select" || field.tag === "select") {
        await browser.select(field.ref, item.answer(profile));
      } else {
        await browser.type(field.ref, item.answer(profile));
      }
    } catch {
      // Continue with other fields
    }
  }

  const nameField = findElementWithFallbacks(snap, [/full name/i, /your name/i]);
  if (nameField && profile.fullName) {
    try {
      await browser.type(nameField.ref, profile.fullName);
    } catch {
      // optional
    }
  }
}
