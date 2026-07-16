# Kairela Platform Changelog

## 2026-07-16 — Priority Product Upgrade 1: Resume-first onboarding

- Redesigned job-seeker onboarding so the first action after auth is resume
  upload; extraction runs through a new grounded `ParsedCareerProfile`
  extractor (deterministic, with an optional AI-assisted, fabrication-guarded
  enhancement) reusing the existing trusted `/api/resumes/master` path.
- Added an editable review screen and a preferences step that only asks
  what the resume (or explicit skip) didn't already answer.
- No database migration: persistence reuses existing `MasterResume`,
  `User`, and `UserSettings` columns with a safe merge/conflict policy that
  never silently overwrites a user-confirmed value.
- Backup branch `backup/kairela-before-resume-first-onboarding` pushed at
  `e4e2e8b` before this work began.
- Unit tests: 169 → 199 passed (+30). Security (23) and migration-contract
  (13) baselines unchanged. Build: 58 → 59 routes
  (+`/api/analytics/onboarding`).
- Full detail: `docs/product/RESUME_FIRST_ONBOARDING.md` and
  `docs/progress/RESUME_FIRST_ONBOARDING_IMPLEMENTATION.md`.
- Confirmed the pre-existing "Confirm DATABASE_URL/DIRECT_URL on
  preview/production Vercel envs" owner action (already tracked below) is
  what blocks full DB-backed verification of this feature's preview
  deployment; Preview environment currently only has `OPENAI_API_KEY`, not
  Supabase/DB credentials.

## 2026-07-16 — Repository and deployment normalization

- Created `release/kairela-v1-rc` from `e310f7e` as the sole active
  Kairela engineering branch going forward.
- `feat/kairela-product-v1` and `feat/kairela-platform-completion` are now
  frozen historical branches; no work was discarded, no history was
  rewritten, no branch was deleted or force-pushed.
- Pushed recovery-only backup branches
  `backup/kairela-combined-before-normalization` (`e310f7e`) and
  `backup/kairela-platform-before-normalization` (`3b5e6ff`).
- Created a clean worktree at `kairela-v1-rc` and linked it to the
  canonical Vercel project `job-agent`
  (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`).
- Added `docs/REPOSITORY_AND_DEPLOYMENT_POLICY.md` defining the branch and
  Vercel project policy going forward.
- Full detail: `docs/progress/BRANCH_AND_DEPLOYMENT_NORMALIZATION.md`.
- Production (`job-agent-mu-steel.vercel.app`) and the Supabase schema were
  not touched.

## 2026-07-16 — WS9/WS10 migration deployment

- Merged `feat/kairela-platform-completion` (WS9 `094c00d`, WS10 `3b5e6ff`)
  into `feat/kairela-product-v1` (now `12eacc2`), resolving conflicts in
  `package.json`, `package-lock.json`, and `consultant-fab.tsx`.
- Resolved a migration-history rename drift: four migrations applied
  remotely under earlier timestamps had been renamed locally under later
  ones; repaired via `supabase migration repair --status reverted`
  (metadata-only, no DDL).
- Fixed missing idempotency guards in `20260713100000_phase2_onboarding.sql`
  and `20260713120000_phase9_11_consultant_subscriptions.sql`.
- Fixed a pre-existing `uuid = text` operator bug (erroneous `auth.uid()::text`
  cast against the `uuid`-typed `users.supabase_id`) in four migrations,
  including the `current_app_user_id()` RLS helper.
- Applied all 20 pending migrations through
  `20260715220000_ws10_gmail_user_isolation.sql` to the linked Supabase
  project (`rcnigoakmxzlqipsaqvu`); remote migration history now matches
  local exactly.
- Verified RLS enabled on all 16 WS7/WS9/WS10-relevant tables, critical
  indexes present, old global `emails_gmail_id_key` constraint dropped in
  favor of the per-user unique index, and zero orphaned resume/application
  relationships.
- Full detail: `docs/progress/WS9_WS10_MIGRATION_DEPLOYMENT.md`.

### Verification
- Typecheck: pass.
- Migration-contract tests: 13 passed.
- Security tests: 23 passed.
- Unit tests: 169 passed.
- Production build: pass (58 routes).

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

## 2026-07-15 — WS7/WS8 current-HEAD reconciliation

- Created `docs/progress/WS7_WS8_CURRENT_HEAD_RECONCILIATION.md`.
- Persisted temporary source-health cooldowns and allow recovery probes after expiry.
- Added admin search-source diagnostics (`/api/admin/search-sources`).
- Wired adapters to consume explainable search-plan queries (location-aware).
- Fixed Possible view so it no longer mixes LOW matches; Saved uses durable `saved_at`.
- Blocked prepare/submit/generate on expired/closed jobs in UI and APIs.
- Cleared stalled search running state so retry remains available.
- Hardened post-tailor grounding with reason codes, gaps, adversarial unit coverage, and persisted reports.
- Built Resume History UX: filters, open/compare/PDF, rename/archive/delete/restore, orphan master label, grounding review.
- Added tailored versioning + history migration `20260715190000_resume_history_grounding.sql`.
- Added master/tailored PDF endpoints and fail-closed history E2E coverage.
- DOCX export intentionally deferred and disclosed in UI.

### Verification
- Lint: pass with preexisting warnings.
- Typecheck: pass.
- Unit tests: 136 passed.
- RLS/migration contracts: 3 passed.
- Production build: pass.
- Playwright WS7: 5 passed; WS8: 3 passed (1 flaky retry).
- Preview: https://kairela-platform-completion-5ovi8n0n6-jack160699s-projects.vercel.app
- Remote DB apply remains an external owner verification item.

## 2026-07-15 — Workstream 9 authenticity hotfix (post-reconciliation)

- Removed invented last-name placeholder (`"-"`) from `fillCommonFields`.
- Shared grounded prepare flow for worker and in-process orchestration; no re-entry into platform adapters after Q&A.
- Missing last name / inventable legal fields stop for human input.
- Cancel updates the application to `FAILED`/`CANCELLED_BY_USER` and mid-run `shouldContinue` checks abort before submit.
- Cancel prep available while prepare tasks are in `PENDING_REVIEW`.
- E2E ATS policy test routed to real `/api/browser/tasks`.

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

## 2026-07-15 — Workstream 9 release closure

- Added explicit application states for missing information, awaiting approval,
  CAPTCHA, login, unsupported platforms and expired postings.
- Added durable active-delivery uniqueness, preparation reuse, terminal replay
  protection and worker timeout/restart recovery.
- Kept final submission behind explicit per-attempt authorization; generic ATS
  support is fill-for-review only.
- Unified Greenhouse, Lever, Ashby and Workday fixtures on the grounded
  preparation flow and added a generic ATS fixture.
- Added CAPTCHA/login handoff detection without challenge bypass.
- Expanded the application tracker with document readiness, chronological
  milestones and an actionable next step.
- Added `20260715200000_ws9_application_automation.sql` and documented remote
  application as an owner/environment action.

### Verification

- Unit tests: 160 passed.
- Integration tests: 158 passed.
- Security tests: 20 passed.
- RLS/migration contracts: 10 passed.
- Typecheck, Prisma validation and production build: passed.
- Playwright ATS/security suite: 7 passed.
- Preview: `https://kairela-platform-completion-nw9chfsg3-jack160699s-projects.vercel.app`.

## 2026-07-15 — Workstream 10 current-HEAD closure

- Fixed password recovery so PKCE and token-hash callbacks preserve the reset
  destination instead of redirecting authenticated recovery sessions.
- Replaced process-local Workspace OAuth replay protection with expiring,
  database-backed single-use nonces bound to the current user session.
- Separated identity login from least-privilege Gmail, Drive, Sheets and Calendar
  scopes; removed unused Gmail send permission.
- Added proactive token refresh persistence, reconnect-required responses and
  reconnect UI copy.
- Enforced granted features before sync and limited API verification to selected
  products without creating test spreadsheets.
- Corrected Gmail direction parsing, base64url decoding and per-user message
  deduplication.

### Verification

- Unit tests: 169 passed.
- Security tests: 23 passed.
- RLS/migration contracts: 13 passed.
- Typecheck, Prisma validation and production build: passed.
- Preview auth pages: 200; unauthenticated Workspace APIs: 401.
- Signed-in reset and integration settings UI verified in browser.
- Preview: `https://kairela-platform-completion-almev0ks4-jack160699s-projects.vercel.app`.
