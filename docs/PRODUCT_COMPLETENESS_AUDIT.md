# Kairela Product Completeness Audit

Audit date: 2026-07-14  
Branch: `feat/kairela-product-v1`  
Production fallback: https://job-agent-mu-steel.vercel.app  
Repository baseline: `7514afd67fed9d2bbb74173a0e49a7eb2d8a03cc`

## Executive finding

The repository is a functional release-candidate foundation, but the previous documentation overstated production completeness. Several named product areas are thin scaffolds rather than complete deployed journeys. The most important verified gaps are job-link intake, agent tool use and conversation management, document workflows, employer/recruiter/agency workflows, billing lifecycle handling, and complete browser-automation state handling.

The initial audit also found three release blockers:

1. `public.browser_tasks` was exposed without RLS.
2. concurrent authenticated page requests caused 580 production user-provisioning unique-key errors;
3. lint and typecheck failed on the release branch.

The RLS issue, user-provisioning race, lint errors, and type errors were corrected during this audit. The production migration `secure_browser_tasks_and_functions` is applied and Supabase now reports RLS enabled on all 22 public tables.

## Verified baseline

### Repository

- Next.js 16 App Router, React 19, TypeScript, Prisma, Supabase, Vercel, Vitest, and Playwright.
- Branch is synchronized with `origin/feat/kairela-product-v1`.
- 49 application routes build successfully.
- Unit tests: 31/31 passing.
- Typecheck: passing after audit fixes.
- Lint: passing with nine non-blocking unused-code warnings.
- Production build: passing after stopping a stale local development process that held Prisma's Windows engine DLL.

### Production and infrastructure

- Vercel project: `job-agent` (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`).
- Current production deployment: `dpl_DqrLhkbbmKXyd9pkVsX4Xv5sb7SX`, deployed from commit `782dea0`.
- Supabase project: `rcnigoakmxzlqipsaqvu`, region `ap-south-1`.
- Production database contains 120 users, 5,704 jobs, 5,703 applications, 47 master resumes, 181 background jobs, and 762 audit logs.
- Latest production migration: `20260714183929_secure_browser_tasks_and_functions`.
- Current Supabase security advisor has no externally facing RLS error. Remaining account-level warnings are leaked-password protection and limited MFA options.

### Production error evidence

Vercel's seven-day runtime error report contains:

- 580 `getDbUser` unique-email conflicts caused by concurrent account provisioning.
- 121 historical Prisma errors from an earlier enum/schema mismatch.
- 25 Vercel function timeouts across job search, worker, cron, and agent routes.
- 18 Supabase Auth failures caused by an exceeded egress quota.
- four invalid refresh-token errors.
- one audit-log database connectivity error.

The provisioning race is fixed in code but requires deployment and post-deployment error verification. Historical timeout and quota groups must be separated from current failures after the next deployment.

## Completeness findings by capability

### Job-link intake — missing

- No `POST /api/jobs/import-link` route exists.
- No dashboard, job-search, applications, mobile, or assistant “Paste a job link” entry point exists.
- Existing ATS `getJobDetails` methods return placeholder titles or empty descriptions for Lever, Ashby, and Workday.
- There is no SSRF-safe arbitrary public page fetcher, redirect validation, extraction failure log, duplicate URL fingerprint, manual correction flow, or imported-job provenance model.

### Live Kairela assistant — partial scaffold

- A floating assistant is mounted across authenticated dashboard routes and is positioned above mobile navigation.
- Messages are persisted per user and entitlement usage is recorded.
- Responses are non-streaming and use a single generic generation call.
- Context currently contains only preferences, counts, onboarding status, and last completed search.
- There is no agent-tool architecture, confirmation protocol, current UI/error context, external-content prompt-injection isolation, conversation model, rename/delete/search, suggested prompts, cancellation, or recoverable streaming state.

### Proactive relationship manager — partial scaffold

- Recommendations can be rendered and basic records exist.
- The schema supports dismiss and snooze.
- Evidence, priority, category controls, completion state, category disablement, digest delivery, frequency enforcement, and grounded salary sample reporting are not complete.

### Job-seeker journey — incomplete

- Authentication, onboarding, preferences, search, jobs, applications, resumes, cover letters, inbox, calendar, and settings routes exist.
- Resume onboarding accepts pasted text rather than the required complete PDF/DOCX upload and review flow.
- Production tables show zero tailored resumes, cover letters, recruiters, interviews, and onboarding-state records, indicating that the named journeys have not been proven in production.
- Several pages present data, but end-to-end persistence and recovery have not yet been verified for refresh, token expiry, queue delay, AI error, and browser-worker failure.

### Search quality — partial

- Preference-aware filters and per-user ATS board selection exist.
- Search still relies heavily on configured board slugs and adapter-specific discovery.
- Source-health scoring, feedback-driven ranking, freshness/expiry maintenance, and realistic India-profile quality evidence are missing.
- Lever, Ashby, and Workday detail adapters contain placeholder extraction behavior.

### Application automation — partial

- Greenhouse, Lever, Ashby, and Workday automator classes and fixture tests exist.
- Browser tasks are queued and a bridge health endpoint exists.
- The product application enum cannot represent the full required state machine (`NEEDS_INFORMATION`, `AWAITING_APPROVAL`, `BLOCKED_CAPTCHA`, `BLOCKED_LOGIN`, `UNSUPPORTED`, `EXPIRED`).
- Queue success currently maps preparation to `PENDING_REVIEW` and exposes an internal task ID in a user-facing message.
- Durable manual handoff, screenshot review UI, approval records, selector telemetry, and production-safe adapter verification remain incomplete.

### Resume and documents — incomplete

- Master resume storage, AI improvement utilities, tailored resume models, cover-letter models, and PDF generation code exist.
- Complete PDF/DOCX upload safety, parsing, version history, per-change accept/reject, diff presentation, truthfulness evidence, ATS analysis, and export lifecycle are absent or unverified.

### Employer, recruiter, and agency — scaffold only

- Persona fields, hiring profile storage, onboarding choices, and a feature-flagged hiring route exist.
- Company jobs, candidate consent/search, pipelines, shortlists, stages, notes, permissions, agency clients, ownership, assignments, CRM, and reporting are not implemented as coherent journeys.
- Production has no hiring-profile records.

### Authentication and Google — partial

- Email authentication, verification, reset, global logout, Google login, and separate Workspace OAuth routes exist.
- Production error history includes quota and refresh-token failures.
- Safe duplicate-account handling required a provisioning-race fix during this audit.
- Workspace disconnect/revoke, reconnect recovery, account-linking audit, bot protection, and production mobile/incognito evidence remain incomplete.

### Subscriptions — foundation only

- Entitlement checks, usage ledger, plan/status enums, and a feature flag exist.
- Current plan enum is `FREE`, `PRO`, `TEAM`; required `PREMIUM` and recruiter semantics are missing.
- There is no complete reset, grace period, downgrade, cancellation, seat, override, invoice, tax, currency, provider abstraction, or verified webhook flow.

### Trust, security, and privacy — partial

- Legal draft pages, basic rate limiting, encrypted-secret storage, audit logs, and RLS exist.
- Security headers are not configured in `next.config.ts`.
- Rate limiting is process-local and cannot enforce a global production limit across Vercel instances.
- `public.background_jobs` is now intentionally inaccessible through the Data API; service-role and direct Prisma workers remain operational.
- Account-level leaked-password protection and additional MFA options require Supabase configuration.
- Complete CSRF review, upload malware controls, data export/deletion, consent enforcement, secret scanning, dependency audit, and prompt-injection defense remain pending.

### Observability and operations — partial

- Health, audit logs, queue records, queue admin UI, Vercel logs, and Supabase advisors provide a base.
- The admin surface is mostly queue-oriented; it does not yet provide the complete users/imports/applications/integrations/AI/entitlements/feature-flags operational inventory.
- Structured metrics, alert thresholds, source health, browser-worker heartbeat, dead-letter SLOs, and runbook evidence are incomplete.

### Mobile and performance — unverified

- A mobile bottom navigation and assistant safe-area offset exist.
- Device-matrix screenshots, visual regression, accessibility scans, current Lighthouse results, route-latency measurements, and before/after metrics have not yet been produced.

## Duplicate, stale, and misleading elements

- `src/components/dashboard/sidebar.tsx` is only a compatibility re-export of the actual app shell.
- Temporary identifiers remain in internal paths and configuration (`job-agent` Vercel project name and temporary-directory name); the public fallback URL is intentionally retained until domain launch.
- The API auth helper contains a development-only `dev@localhost` fallback and must remain impossible in production.
- Release documentation marked phases 4–15 complete even though critical journeys are scaffolded or unverified.
- Existing production records alone do not prove successful document generation or application submission; the relevant production tables are empty.

## Remediation order

1. Finish and deploy audit blockers; verify provisioning errors stop.
2. Implement secure job-link intake and its complete UI/API/database/test journey.
3. Replace generic consultant chat with streaming conversations and a confirmed agent-tool architecture.
4. Ground and complete proactive recommendations.
5. Complete the job-seeker journey, document workflows, search feedback, and application state machine.
6. Complete feature-flagged hiring modes and privacy controls.
7. Complete auth/integration recovery and billing readiness.
8. Complete mobile, legal/security, observability, copy, and release audits.

## Deferred actions

The following are deliberately not part of this audit execution:

- attaching or configuring `kairela.com`;
- final human acceptance testing.

Both remain deferred until explicit approval after all automatable workstreams are complete.
