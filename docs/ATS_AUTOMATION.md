# ATS Automation Policy

## Hard Rules

1. Never invent answers for unknown fields.
2. Never bypass CAPTCHA, MFA, login walls, or payment walls.
3. Never submit unless the user authorized submission for that attempt.
4. Prefer known ATS adapters (Greenhouse, Lever, Ashby, Workday) before Playwright.
5. Stop and escalate anytime authenticity or safety is ambiguous.

## Classification Outcomes

| Condition | Mapping |
|---|---|
| CAPTCHA / bot check | `NEEDS_INPUT` + human escalation |
| Login / SSO / MFA | `NEEDS_INPUT` + human escalation |
| Missing required answer | `NEEDS_INPUT` / `MANUAL_REQUIRED` |
| Adapter or browser timeout | `FAILED` (retryable) |
| Confirmed submission | `APPLIED` / `SUBMITTED` |

## Answer Policy

Automation may fill only facts present on the applicant profile and settings:
name, email, phone, LinkedIn, location, experience years, salary range,
sponsorship preference, relocation preference, work-mode preference, and notice period.

It must not invent work authorization, demographics, or any other unanswered field.
When an inventable or unknown field is detected, preparation stops for human input.

## Agent vs Submission

Scheduled and one-click agent runs can search, analyze, match, and prepare.
They must not submit.

Final submission is only allowed through the applications API after
`validateSubmissionAuthorization({ autoSubmit: true, confirmed: true })`.

## UI Contract

Applications with browser tasks poll `/api/browser-tasks/:id` until terminal state.
Users can cancel a queued/running browser attempt; cancelled attempts become `FAILED` with a clear reason.
Retry is only offered for terminal failures and requires a fresh confirmation.
