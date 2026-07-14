# Proactive Career Manager

## Purpose

Kairela generates calm, evidence-backed next steps from authorized user data. It does not manufacture urgency, guarantee salary outcomes, or send external messages.

## Grounded recommendation categories

- Profile completeness
- Search freshness
- Strong job matches
- Applications awaiting review
- Unread recruiter replies
- Interviews within 72 hours
- Google integrations requiring reconnection
- Usage limits approaching exhaustion

Each recommendation stores:

- category and priority;
- reason and structured evidence;
- suggested action and internal destination;
- creation and optional expiration time;
- active, snoozed, dismissed, done, or expired status.

Salary guidance is deliberately omitted until Kairela has a defensible dataset containing sample size, role, seniority, geography, currency, and time window.

## Generation

`generateProactiveRecommendations(userId)` builds a user-scoped snapshot and passes it to pure rules in `src/lib/proactive/rules.ts`.

Generation occurs:

1. when the authenticated dashboard requests recommendations; and
2. through the `GENERATE_RECOMMENDATIONS` scheduled background job.

Frequency limits and quiet hours are enforced before generation. Recent recommendations are deduplicated per type.

## User controls

- Dismiss
- Snooze for 24 hours
- Mark done
- Disable a recommendation category
- Pause all recommendations
- Configure quiet hours and minimum frequency
- Enable daily digest or weekly career report preferences

Digest/report preferences are persisted for notification delivery integrations. No email is sent without separate email authorization.

## Security and privacy

- Every query is constrained by the authenticated application user ID.
- API actions verify recommendation ownership.
- Input is validated with Zod.
- RLS binds `proactive_recommendations.user_id` through `users.supabase_id` to `auth.uid()`.
- The API is rate limited.

## Tests

- Pure rule tests cover profile gaps, search freshness, strong matches, application review, interview timing, category filtering, and prioritization.
- Playwright covers unauthenticated denial, authenticated API shape, and recommendation settings UI.
