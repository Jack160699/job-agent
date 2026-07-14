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
| Missing required answer | `NEEDS_INPUT` |
| Adapter or browser timeout | `FAILED` (retryable) |
| Confirmed submission | `APPLIED` |

## UI Contract

Applications with browser tasks poll `/api/browser-tasks/:id` until terminal state.
Users can cancel a queued/running browser attempt; cancelled attempts become `FAILED` with a clear reason.
Retry is only offered for terminal failures and requires a fresh confirmation.
