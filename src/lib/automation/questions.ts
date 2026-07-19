import type { ApplicationProfile, BrowserAutomationClient } from "@/lib/browser/types";
import { findElementWithFallbacks } from "./resilient";

export type KnownFieldAnswer = {
  key: string;
  patterns: RegExp[];
  value?: string | null;
};

/**
 * Only return answers grounded in the applicant profile.
 * Never invent authorization, sponsorship, demographics, or notice facts.
 */
export function buildKnownFieldAnswers(
  profile: ApplicationProfile
): KnownFieldAnswer[] {
  const bank = profile.confirmedAnswers ?? {};
  const salary =
    bank.salary_expectation ??
    (profile.salaryMin != null || profile.salaryMax != null
      ? [
          profile.salaryMin != null ? String(profile.salaryMin) : null,
          profile.salaryMax != null ? String(profile.salaryMax) : null,
        ]
          .filter(Boolean)
          .join(" - ") +
        (profile.salaryCurrency ? ` ${profile.salaryCurrency}` : "")
      : null);

  const prefersRemote = profile.workModes?.includes("REMOTE");
  const prefersHybrid = profile.workModes?.includes("HYBRID");
  const remoteAnswer =
    prefersRemote === true
      ? "Yes"
      : prefersRemote === false && prefersHybrid === false
        ? "No"
        : null;

  return [
    {
      key: "full_name",
      patterns: [/full name/i, /your name/i, /^name$/i],
      value: profile.fullName || null,
    },
    {
      key: "first_name",
      patterns: [/first name/i, /given name/i],
      value: profile.fullName?.trim().split(/\s+/).filter(Boolean)[0] || null,
    },
    {
      key: "last_name",
      patterns: [/last name/i, /family name/i, /surname/i],
      value: (() => {
        const parts = profile.fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
        return parts.length > 1 ? parts.slice(1).join(" ") : null;
      })(),
    },
    {
      key: "email",
      patterns: [/email/i, /e-mail/i],
      value: profile.email || null,
    },
    {
      key: "phone",
      patterns: [/phone/i, /mobile/i, /telephone/i],
      value: profile.phone || null,
    },
    {
      key: "linkedin",
      patterns: [/linkedin/i],
      value: profile.linkedinUrl || null,
    },
    {
      key: "location",
      patterns: [/current location/i, /city/i, /where are you located/i],
      value: profile.location || null,
    },
    {
      key: "years_experience",
      patterns: [/years of experience/i, /how many years/i],
      value:
        bank.years_experience ??
        (profile.experienceYears != null
          ? String(profile.experienceYears)
          : null),
    },
    {
      key: "salary_expectation",
      patterns: [/salary expectation/i, /desired compensation/i, /expected salary/i],
      value: salary,
    },
    {
      key: "current_salary",
      patterns: [/current salary/i, /current compensation/i, /present salary/i],
      value: bank.current_salary ?? null,
    },
    {
      key: "sponsorship",
      patterns: [/sponsorship/i, /visa/i, /require sponsorship/i],
      value:
        bank.sponsorship ??
        (profile.visaSponsorshipRequired == null
          ? null
          : profile.visaSponsorshipRequired
            ? "Yes"
            : "No"),
    },
    {
      key: "work_authorization",
      patterns: [
        /authorized to work/i,
        /legally authorized/i,
        /work authorization/i,
      ],
      value: bank.work_authorization ?? null,
    },
    {
      key: "relocation",
      patterns: [/willing to relocate/i, /open to relocation/i],
      value:
        bank.relocation ??
        (profile.willingToRelocate == null
          ? null
          : profile.willingToRelocate
            ? "Yes"
            : "No"),
    },
    {
      key: "remote",
      patterns: [/remote/i, /work from home/i, /hybrid/i],
      value: bank.remote ?? remoteAnswer,
    },
    {
      key: "notice_period",
      patterns: [/start date/i, /earliest start/i, /when can you start/i, /notice/i],
      value:
        bank.start_date ??
        bank.notice_period ??
        (profile.noticePeriodDays != null
          ? `${profile.noticePeriodDays} days`
          : null),
    },
    {
      key: "travel_willingness",
      patterns: [/willing to travel/i, /travel willingness/i, /travel required/i],
      value: bank.travel_willingness ?? null,
    },
    {
      key: "portfolio",
      patterns: [/portfolio/i, /github/i, /work samples/i],
      value: bank.portfolio ?? null,
    },
    {
      key: "government_category",
      patterns: [/government category/i, /reservation category/i, /caste category/i],
      value: bank.government_category ?? null,
    },
    {
      key: "government_eligibility",
      patterns: [/government eligibility/i, /public sector eligibility/i],
      value: bank.government_eligibility ?? null,
    },
  ];
}

export type AnswerCommonQuestionsResult = {
  answered: string[];
  unanswered: string[];
};

export async function answerCommonQuestions(
  browser: BrowserAutomationClient,
  profile: ApplicationProfile
): Promise<AnswerCommonQuestionsResult> {
  const snap = await browser.snapshot();
  const answered: string[] = [];
  const unanswered: string[] = [];
  const known = buildKnownFieldAnswers(profile);

  for (const item of known) {
    const field = findElementWithFallbacks(snap, item.patterns);
    if (!field) continue;

    if (!item.value) {
      unanswered.push(item.key);
      continue;
    }

    try {
      if (field.role === "select" || field.tag === "select") {
        await browser.select(field.ref, item.value);
      } else {
        await browser.type(field.ref, item.value);
      }
      answered.push(item.key);
    } catch {
      unanswered.push(item.key);
    }
  }

  // Sensitive or legal questions with no stored truth must stop for human input.
  const inventableBlocked = [
    ...(profile.confirmedAnswers?.work_authorization
      ? []
      : [
          {
            key: "work_authorization",
            patterns: [
              /authorized to work/i,
              /legally authorized/i,
              /work authorization/i,
            ],
          },
        ]),
    { key: "demographics", patterns: [/gender/i, /race/i, /ethnicity/i, /veteran/i, /disability/i] },
  ];

  for (const item of inventableBlocked) {
    const field = findElementWithFallbacks(snap, item.patterns);
    if (field) unanswered.push(item.key);
  }

  return {
    answered: [...new Set(answered)],
    unanswered: [...new Set(unanswered)],
  };
}
