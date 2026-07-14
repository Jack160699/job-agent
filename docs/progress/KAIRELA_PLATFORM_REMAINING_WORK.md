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
| 1 | P0 security and reliability | **In progress** — OAuth state, browser worker, rate limits, redirect fix |
| 2 | CI, release and operational foundation | Started — GitHub Actions + scripts |
| 3 | Public job-link intake | Complete (inherited from product-v1) |
| 4 | Live Kairela AI career agent | Pending |
| 5 | Proactive career relationship manager | Pending |
| 6 | Complete job-seeker journey | Pending |
| 7 | Search quality and relevance | Pending |
| 8 | Resume and document intelligence | Pending |
| 9 | Application agent and ATS automation | Pending |
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

- RLS `WITH CHECK` hardening on legacy policies
- Entitlement enforcement on search/agent/resume APIs
- Lever/Ashby/Workday adapter real extraction
- Application status enum expansion
- PDF/DOCX resume upload pipeline
- Security headers in next.config.ts
- Distributed rate limit table migration applied to production

## Deferred final actions

- Attach `kairela.com`
- Final owner-led human acceptance testing
