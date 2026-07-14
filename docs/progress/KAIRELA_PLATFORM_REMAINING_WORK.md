# Kairela Platform Remaining Work

Status: in progress  
Branch: `feat/kairela-platform-completion`  
Worktree: `../kairela-platform-completion`  
Production fallback: https://job-agent-mu-steel.vercel.app

## Concurrency note

Codex is rebuilding the public landing page on `feat/kairela-product-v1` with uncommitted changes to `app/page.tsx`, `components/landing/**`, and `docs/design/**`. Platform work runs in an isolated worktree/branch and must not touch landing-page files.

## Workstream status

| # | Workstream | Status |
|---|------------|--------|
| 0 | Complete product audit | **Complete** |
| 1 | P0 security and reliability | **Complete** — OAuth state, browser worker, durable rate limits, redirect fix |
| 2 | CI, release and operational foundation | **Complete (foundation)** — GitHub Actions + release scripts/runbooks |
| 3 | Public job-link intake | Complete (inherited from product-v1) |
| 4 | Live Kairela AI career agent | Partial — read-only tool layer, page context, suggested prompts and streaming route exist; conversation CRUD and confirmed write tools remain |
| 5 | Proactive career relationship manager | **Complete** — grounded rules, evidence, priority, expiry, queue generation and user controls |
| 6 | Complete job-seeker journey | Partial — recovery/security slice complete; document, ATS and auth journeys depend on WS8/9/10 |
| 7 | Search quality and relevance | **Complete** — freshness, feedback learning and real ATS extraction |
| 8 | Resume and document intelligence | **Complete** — PDF/DOCX/text parse, version history, PDF export |
| 9 | Application agent and ATS automation | **Current** |
| 10 | Authentication and Google integrations | Partial |
| 11 | Employer, recruiter and agency modes | Scaffold (flagged off) |
| 12 | Subscriptions and entitlements | Foundation only |
| 13 | Mobile UX and performance | Pending |
| 14 | Security, privacy and user control | Partial |
| 15 | Observability and admin operations | Partial |
| 16 | Product copy and polish | Pending |
| 17 | Landing-page integration | Blocked on Codex |
| 18 | Final prelaunch release candidate | Pending |

## Open P0/P1 carryovers

- RLS `WITH CHECK` hardening on remaining legacy policies
- Entitlement enforcement on search/agent/resume APIs
- Application status enum expansion
- Security headers in next.config.ts
- Migrations `20260715100000_rate_limits.sql` and `20260715113000_proactive_recommendations_v2.sql` applied to production
- AI assistant conversation CRUD, confirmed write-tool policy and streaming UI

## Deferred final actions

- Attach `kairela.com`
- Final owner-led human acceptance testing
