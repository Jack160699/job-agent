# Kairela Platform Remaining Work

Status: in progress  
Branch: `release/kairela-v1-rc` (canonical as of 2026-07-16 — see `docs/REPOSITORY_AND_DEPLOYMENT_POLICY.md`)  
Worktree: `C:\Users\shriyansh chandrakar\kairela-v1-rc`  
Production fallback: https://job-agent-mu-steel.vercel.app

`feat/kairela-platform-completion` and `feat/kairela-product-v1` are now
frozen historical branches; their prior worktrees at
`../kairela-platform-completion` and `../job apply agent` still exist for
reference but should not receive new work.

## Concurrency note

Codex was rebuilding the public landing page on `feat/kairela-product-v1` with uncommitted changes to `app/page.tsx`, `components/landing/**`, and `docs/design/**`. That branch is now frozen historical; the owner needs to coordinate moving this in-progress landing work onto `release/kairela-v1-rc`. Platform work runs in an isolated worktree/branch and must not touch landing-page files.

## Workstream status

| # | Workstream | Status |
|---|------------|--------|
| 0 | Complete product audit | **Complete** |
| 1 | P0 security and reliability | **Complete** |
| 2 | CI, release and operational foundation | **Complete (foundation)** |
| 3 | Public job-link intake | Complete (inherited) |
| 4 | Live Kairela AI career agent | **Complete (code)** — conversations, proposals, confirm route; streaming endpoint exists |
| 5 | Proactive career relationship manager | **Complete** |
| 6 | Complete job-seeker journey | **Complete (core loop)** — Generate docs, prepare gate, browser poll, agent resume; inbox/interview manual create remain polish |
| 7 | Search quality and relevance | **Complete (HEAD reconciled)** — plan queries consumed, source cooldown recovery, admin source health, expire prepare gate, saved/excluded views |
| 8 | Resume and document intelligence | **Complete (HEAD reconciled)** — master-delete SET NULL, grounding-v2 report, full Resume History UX |
| 9 | Application agent and ATS automation | **Complete (release gate)** — explicit state machine, idempotent/recoverable delivery, grounded provider fixtures, review default and accurate tracker |
| 10 | Authentication and Google integrations | **Complete (code/release gate)** — durable OAuth state, recovery routing, least-privilege scopes, refresh/reconnect, revoke and four Workspace integrations |
| 11 | Employer, recruiter and agency modes | Scaffold (flagged off) |
| 12 | Subscriptions and entitlements | Partial — execution-path enforcement landed; Stripe activation external |
| 13 | Mobile UX and performance | Partial — bottom-nav CSS fix landed; skeletons/viewport evidence remain |
| 14 | Security, privacy and user control | Partial — headers + RLS hardening migration landed |
| 15 | Observability and admin operations | Partial — public health minimized; source-health admin table added; richer inventory remains |
| 16 | Product copy and polish | Partial — misleading defaults and cover-letter placeholder fixed |
| 17 | Landing-page integration | Blocked on Codex |
| 18 | Final prelaunch release candidate | Pending |

## 2026-07-16 — Repository and deployment normalization

`release/kairela-v1-rc` created from `e310f7e` as the sole active branch.
`feat/kairela-product-v1` and `feat/kairela-platform-completion` are frozen
historical. Backup branches
`backup/kairela-combined-before-normalization` and
`backup/kairela-platform-before-normalization` pushed for recovery. See
`docs/progress/BRANCH_AND_DEPLOYMENT_NORMALIZATION.md`.

## 2026-07-16 — Performance, ATS Intelligence, and Job-Search Reliability V1

Implemented on temporary branch `feat/performance-ats-search-v1` (NOT merged
to master, NOT deployed to Production — preview only). See
`docs/progress/PERFORMANCE_ATS_SEARCH_V1_IMPLEMENTATION.md`. Delivered:
ATS Readiness Score engine, instant (non-AI-blocking) resume upload,
parallel job-search sources, N+1 persistence fix, targeted interactive
job-claim kick, Server-Timing instrumentation, and a scoped set of
dashboard performance improvements. Explicitly deferred: job-specific ATS
scoring, tailored before/after scoring, full inline-editable resume review
sections, search-quality/location-synonym work, and progressive
Retry/Cancel/Broaden search UX — see the implementation doc's "Remaining
limitations" for the complete list and reasoning.

## 2026-07-16 — Priority Product Upgrade 2: LinkedIn OIDC sign-in

Implemented, tested, and pushed to `release/kairela-v1-rc`; preview deployment
created (not promoted to production, not merged to `master`). Feature flag
(`NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED`) left off everywhere. See
`docs/product/LINKEDIN_OIDC_AUTH.md` and
`docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md` for full detail. Remaining
follow-ups:

- Complete LinkedIn Developer app + Supabase provider setup (owner-only —
  Client ID/Secret never belong in this repo).
- Live LinkedIn verification is BLOCKED — no Supabase Dashboard or
  LinkedIn credentials were available to this change.
- Run `e2e/linkedin-oidc-auth.spec.ts` against the preview URL once
  Preview-environment DB credentials are configured (same gap tracked
  below for resume-first onboarding) and the flag is enabled there.
- Confirm whether Supabase manual identity linking is enabled for this
  project (needed for the Settings "Connect LinkedIn" action).

## 2026-07-16 — Priority Product Upgrade 1: Resume-first onboarding

Implemented, tested, and pushed to `release/kairela-v1-rc`; preview deployment
created (not promoted to production, not merged to `master`). See
`docs/product/RESUME_FIRST_ONBOARDING.md` and
`docs/progress/RESUME_FIRST_ONBOARDING_IMPLEMENTATION.md` for full detail.
Remaining follow-ups:

- Run `e2e/resume-first-onboarding.spec.ts` against the preview URL once
  Preview-environment DB credentials are configured (see next item).
- Preview Vercel environment is missing `DATABASE_URL`/`DIRECT_URL`/Supabase
  keys (only `Production` has them) — this was already tracked below and now
  also blocks live verification of this feature's preview deployment.
- Consider inline editing of individual experience/education/project entries
  on the review screen (currently read-only display with chip-based editing
  for skills/job titles only).
- LinkedIn login, the full site-wide white/blue redesign, and
  employer/recruiter onboarding remain explicitly out of scope for this
  change and are tracked as separate future work.

## Open carryovers

- Authenticated production E2E once Supabase egress recovers
- Complete owner-approved live Google consent/refresh/revoke verification
- Owner approval for `kairela.com` attach and human acceptance
- Stripe billing activation remains external
- DOCX export deferred (PDF authorized downloads only)
- Pin `search_path` on `public.current_app_user_id()` in a follow-up migration (Supabase security advisor)

## 2026-07-16 — Migrations applied through WS10

Production/preview migrations through `20260715220000_ws10_gmail_user_isolation.sql`
are now applied to the linked Supabase project (`rcnigoakmxzlqipsaqvu`), including a
resolved migration-history rename drift and two pre-existing SQL bugs found and
fixed along the way. See `docs/progress/WS9_WS10_MIGRATION_DEPLOYMENT.md` for
full detail. Typecheck, migration-contract (13), security (23), unit (169) tests,
and the production build all pass post-migration.

## Optional P2 backlog

- Inbox mark-as-read / sync polish
- Manual interview creation

## Deferred final actions

- Attach `kairela.com`
- Final owner-led human acceptance testing
