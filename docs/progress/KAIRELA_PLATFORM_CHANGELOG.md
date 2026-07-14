# Kairela Platform Changelog

## 2026-07-15 — Workstream 0–1 (feat/kairela-platform-completion)

### Security
- Signed Google Workspace OAuth state (HMAC, expiry, nonce replay protection, session binding)
- Browser MCP bridge fails closed without `BROWSER_WORKER_TOKEN` in production
- Browser status/tasks endpoints require authentication; consistent 401 responses
- Auth callback blocks open-redirect via `next` parameter validation
- Postgres-backed durable rate limiting with per-route presets
- Rate limits added to consultant, recommendations, admin, Google OAuth routes

### CI / tooling
- GitHub Actions `release-validation.yml`
- Scripts: `test:unit`, `test:security`, `test:e2e:smoke`, `verify:release`, `typecheck`

### Documentation
- `docs/PRODUCT_PLATFORM_AUDIT.md`
- `docs/AUTH_SECURITY_REVIEW.md`, `docs/BROWSER_WORKER_SECURITY.md`
- `docs/CI_CD_RUNBOOK.md`, `docs/RELEASE_GATES.md`
- `docs/MANUAL_EXTERNAL_ACTIONS.md`
- Platform execution state tracking

### Migration
- `20260715100000_rate_limits.sql` — durable rate limit buckets table

## 2026-07-15 — Workstream 5

### Proactive career manager
- Added evidence-backed rules for profile completion, stale searches, strong matches, application review, recruiter replies, interviews, integration reconnects, and usage limits.
- Added priority, expiration, completion state, snooze, category disablement, quiet hours, frequency limits, and digest/report preferences.
- Added durable `GENERATE_RECOMMENDATIONS` background jobs.
- Added loading, retry, empty, success, and action-failure UI states.
- Added strict settings API validation, removing the prior mass-assignment path.
- Corrected recommendation RLS to map `auth.uid()` through `users.supabase_id`.

### Verification
- Unit tests: 52 passed, including 5 proactive rule tests.
- Typecheck: passed.
- Lint: passed with 9 pre-existing warnings.
- Production build: passed (51 routes).

## 2026-07-15 — Workstream 6 recovery checkpoint

- Removed the development fallback user from every product API; authenticated APIs now fail closed.
- Added explicit confirmation enforcement before application submission.
- Added per-user/application browser-task deduplication and removed task IDs from user-facing messages.
- Added cooperative job-search cancellation without discarding results already saved.
- Replaced full-page reloads in resume and application actions with route refreshes.
- Added strict resume payload validation and consistent unauthorized responses.
- Added security tests for submission authorization and Playwright coverage for unauthenticated workflow APIs.

### Verification
- Unit tests: 55 passed.
- Typecheck: passed.
- Lint: passed with 8 pre-existing warnings.
- Production build: passed (51 routes).
