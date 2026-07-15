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

## 2026-07-15 — Workstream 7

- Replaced Lever, Ashby, and Workday detail placeholders with public API extraction.
- Replaced browser-snapshot Workday discovery with the public CXS search API.
- Added posting freshness to transparent match scoring and surfaced unknown-date uncertainty.
- Added per-job relevance feedback with reason codes, authenticated API ownership, RLS, and dashboard controls.
- Applied bounded feedback adjustments to later searches without overriding hard preference rejections.

### WS7 gap completion (preference-aware discovery)

- Audited the search pipeline in `docs/progress/WS7_SEARCH_QUALITY_AUDIT.md`.
- Added per-user search plans with explainable queries and durable `search_plans`.
- Added India-first location aliases and remote-scope handling (Pune not replaced by SF).
- Added role/seniority normalization with hard rejections for inappropriate seniority.
- Switched classifications to transparent `STRONG` / `POSSIBLE` / `LOW` / `REJECTED` with versioned factors.
- Stopped shared env board leakage; discovery boards are user-scoped.
- Added semantic/URL/fingerprint deduplication with provenance, source-health tracking, and expiry transitions.
- Expanded feedback reasons and undo; broadened result views (Recommended/Possible/Saved/Imported/Excluded/Expired).
- Mapped backend progress stages to user-facing search journey labels.

### Verification
- Unit tests: 115 passed.
- Typecheck: passed.
- Lint: passed with pre-existing warnings.
- Production build: passed.
- Playwright WS7 fail-closed suite: 4 passed.

## 2026-07-15 — Workstream 8

- Added PDF/DOCX/text resume parsing with spoof and size checks.
- Preserved resume section structure and skill detection without inventing content.
- Added master-resume version history, restore, edit, and delete controls.
- Added ownership-checked tailored resume PDF downloads.
- Documented intake, versioning, and no-invention policies.

### WS8 residual polish

- Exposed master-resume History from the default card view (not only the edit path).
- Mapped common parser/validation failures to HTTP 400 instead of 500.
- Expanded detected skill vocabulary with common non-invented India-market skills.
- Added fail-closed Playwright coverage for mutating resume APIs and tailored PDF export.

### Verification
- Unit tests: 69 passed, including resume parser cases.
- Typecheck: passed.
- Lint: passed with 8 pre-existing warnings.
- Production build: passed (54 routes).

## 2026-07-15 — Workstream 9 complete + authenticity hotfix

- Classification outcomes and live browser task status/cancel/retry UX.
- Removed fabricated ATS answers; automation fills only grounded profile facts.
- Agent/scheduled runs prepare only and never submit; per-attempt confirmation remains required.
- Fixed element matching so role/tag hints cannot invent field hits.

## 2026-07-15 — Workstream 10 + entitlements/security slice

- Google connect lifecycle: select scopes before connect, disconnect/verify/sync, refresh-token merge, feature union, provider revoke, health reporting.
- Entitlement enforcement on search, resume tailor, and confirmed submissions with UTC windows and PAST_DUE/CANCELLED fallback to FREE.
- Global security headers in `next.config.ts`.
- Legacy RLS hardening migration `20260715150000_harden_legacy_rls.sql`.
- Public `/api/health` minimized; diagnostics admin-gated.
- Removed settings placeholder defaults and cover-letter `[Your Name]` invention.
- Fixed consultant history duplicate user message.

### Verification
- Unit tests: 79 passed.
- Typecheck: passed.
- Lint: passed with 8 pre-existing warnings.
- Production build: passed (52 routes).

## 2026-07-15 — Workstream 4 conversation completion

- Added `consultant_conversations` and `agent_action_proposals` models/migration.
- Consultant chat binds messages to conversations with latest-50 history.
- Proposal tools for start search and prepare application require UI confirmation.
- Confirm route executes single-use proposals and never trusts model `confirmed` flags.
- FAB supports new conversation + confirm action cards.
- Added dashboard loading skeleton.

### Verification
- Unit tests: 82 passed.
- Typecheck: passed.
