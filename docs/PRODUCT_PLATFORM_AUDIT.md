# Kairela Platform Audit

Audit date: 2026-07-15  
Branch: `feat/kairela-platform-completion`  
Baseline commit: `a179987`  
Production fallback: https://job-agent-mu-steel.vercel.app  
Excluded from scope: public landing page (`app/page.tsx`, `components/landing/**`) — handled by Codex on `feat/kairela-product-v1` worktree.

## Executive finding

Kairela has a substantial release-candidate foundation with real auth, onboarding, preferences, job search, applications, consultant chat, job-link import, and admin queue tooling. It is **not** production-complete: hiring/billing are scaffolds, the AI agent lacks tool-calling architecture, adapter quality is uneven, and several security controls were open at audit start.

This platform branch addresses P0 security (OAuth state signing, browser-worker fail-closed, durable rate limiting) and begins CI/release foundations.

## Severity legend

| Level | Meaning |
|-------|---------|
| P0 | Release blocker / exploitable security |
| P1 | Core product or high-trust gap |
| P2 | Quality, polish, observability |
| External | Requires owner/infra action |
| Deferred | Intentionally gated until launch |

---

## P0 — Security and reliability (addressed in WS1)

| ID | Finding | Status |
|----|---------|--------|
| OAUTH-01 | Google Workspace OAuth `state` was unsigned base64 JSON; callback trusted attacker-controlled `userId` | **Fixed** — HMAC-signed state, expiry, nonce replay protection, session binding |
| BRW-01 | MCP bridge accepted unauthenticated requests when `BROWSER_WORKER_TOKEN` unset | **Fixed** — fail-closed in production; localhost bind |
| BRW-02 | `/api/browser/status` public with bridge URL disclosure | **Fixed** — requires authenticated user |
| AUTH-01 | Auth callback `next` param allowed open redirects | **Fixed** — internal path validation |
| RL-01 | Rate limiting was in-memory only | **Fixed** — Postgres-backed buckets with memory fallback |

## P0 — Remaining

| ID | Finding | Notes |
|----|---------|-------|
| RLS-01 | Early policies lack `WITH CHECK` on writes | Defense-in-depth; app uses Prisma service role |
| EXT-01 | Supabase `exceed_egress_quota` blocks authenticated production E2E | Upgrade project or remove spend cap |

---

## P1 — Core product gaps

| Area | Status | Key paths |
|------|--------|-----------|
| Live Kairela AI agent | Partial scaffold | `api/consultant/chat`, `components/consultant/consultant-fab.tsx` |
| Proactive career manager | Rule-based only | `lib/proactive/service.ts` |
| Job search adapters | Lever/Ashby/Workday placeholders | `lib/jobs/adapters.ts` |
| Application state machine | Missing blocked/captcha/login states | `prisma/schema.prisma` |
| Resume intelligence | Text paste only, no PDF/DOCX pipeline | `api/resumes/master` |
| Entitlements enforcement | Ledger exists, APIs mostly ungated | `lib/entitlements/index.ts` |
| CI / release scripts | Was absent | `.github/workflows/release-validation.yml` (added) |
| Observability | Queue-centric admin only | `dashboard/admin/**` |

## P2 — Quality and polish

- Mobile device matrix unverified in CI
- Security headers not in `next.config.ts`
- Old `job-agent` internal naming in config/scripts
- Consultant non-streaming; no conversation CRUD
- Visual regression exists but not wired as smoke gate

## External / manual

- Rotate historical shared E2E account password (was in Git history)
- Attach `kairela.com` and DNS (deferred)
- Final human acceptance testing (deferred)
- Supabase leaked-password protection + MFA (dashboard)
- Stripe/Razorpay credentials for billing activation

## Deferred until launch

- Hiring employer/recruiter/agency modes (feature-flagged off)
- Real billing checkout
- Landing-page integration (Workstream 17 — wait for Codex branch)

---

## Completeness matrix

| Capability | Complete | Partial | Missing |
|------------|----------|---------|---------|
| Email/Google auth | ✓ | | |
| Onboarding | ✓ | | |
| Preferences | ✓ | | |
| Job search | | ✓ | |
| Job-link import | ✓ | | |
| Consultant chat | | ✓ | |
| Agent orchestrator | | ✓ | |
| Proactive recs | | ✓ | |
| Applications | | ✓ | |
| Browser automation | | ✓ | |
| Google Workspace | ✓ | | |
| Subscriptions | | ✓ | |
| Hiring modes | | | ✓ (scaffold) |
| Admin ops | | ✓ | |
| CI | ✓ (initial) | | |

## Test inventory

- Unit test files: 12 (including new security tests)
- E2E specs: 13 files under `e2e/`
- Scripts: `test:unit`, `test:security`, `test:e2e:smoke`, `verify:release` added

## Remediation order

1. ~~P0 security~~ (this branch)
2. CI and release gates
3. Live contextual AI agent with tools
4. Proactive relationship manager
5. Job-seeker journey completion
6. Search quality + adapter details
7. Resume/document pipeline
8. Application state machine
9. Entitlements enforcement
10. Mobile/performance/observability
11. Landing integration after Codex completes
