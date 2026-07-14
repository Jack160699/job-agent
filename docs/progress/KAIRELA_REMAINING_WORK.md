# Kairela Remaining Work

Status: in progress  
Current workstream: 3 — Live Kairela AI assistant  
Production fallback: https://job-agent-mu-steel.vercel.app  
Branch: `feat/kairela-product-v1`

## Current checkpoint

- Workstream 1 completeness audit recorded in `docs/PRODUCT_COMPLETENESS_AUDIT.md`.
- Parallel static audits (architecture map + tests/security) agree: substantial RC codebase, not production-complete; hiring/billing are placeholders; OAuth state, rate limits, observability, and CI remain open. Live production-journey audit failed to run (MCP tooling unavailable).
- Browser-task RLS and permissive `background_jobs` policy already patched in `305de26` / migration `20260714183600`.
- Workstream 2 deployed: commit `9631599`, deployment `dpl_AXAbTYjgDBLNfodvVBszeiXiZr1j`.
- Hard-coded E2E shared credentials removed from the repo; authenticated Playwright now requires `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (rotate the old shared account password in Supabase).
- Lint/typecheck for WS2 import-link code is green after DNS/JSON-LD typing fixes.
- Authenticated production E2E still blocked by Supabase `exceed_egress_quota`.
- Domain attachment and final human acceptance testing remain deferred.

## Open P0 / P1 carryovers (from audits)

- Sign/verify Google integration OAuth state and bind to session.
- Browser worker: fail closed without token; tighten URL allowlists; drop `--no-sandbox` / run non-root where possible.
- Fix incorrect RLS identity comparisons (`auth.uid()` vs `users.supabase_id`) on phase-2/9 policies.
- Settings API mass-assignment; health/browser status must not leak internals publicly.
- Distributed rate limiting; CI workflows; durable document storage for generated PDFs.
- Rotate leaked test account credentials if that account still exists in production Auth.

## Remaining workstreams

1. Product-wide completeness audit — complete
2. Job link intake — complete
3. Live Kairela AI assistant — next
4. Proactive career relationship manager
5. Job-seeker experience completion
6. Search quality and discovery
7. Application agent completion
8. Resume and document intelligence
9. Employer, recruiter, and agency modes
10. Authentication completion
11. API and integration completion
12. Subscriptions and billing readiness
13. Mobile UX and performance
14. Trust, legal, security, and privacy
15. Observability and operations
16. Product polish
17. Pre-final release audit

## Deferred final actions

- Attach and configure `kairela.com` only after explicit approval.
- Perform final human acceptance testing only after explicit approval.

## Deployment evidence

### Job-link intake deployment

- Commit: `9631599f1bbc51e7d194b6f48c7702ac8fd7d869`
- Deployment: `dpl_AXAbTYjgDBLNfodvVBszeiXiZr1j`
- Production URL: https://job-agent-mu-steel.vercel.app
- Build: passed
- Migration: `20260714191000_job_link_intake` applied
- Unit tests: 37 passed

### Audit baseline deployment

- Commit: `305de26d8df2522830a40e9899120053643c9cde`
- Deployment: `dpl_DsgGZFJvV4YQDHccBYbeUJK6daMx`
- Playwright: 57 passed, 33 failed, 2 did not run (egress quota + stale hero copy; hero now fixed)
