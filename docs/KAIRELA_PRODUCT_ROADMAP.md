# Kairela Product Roadmap

**Brand:** Kairela  
**Primary domain:** https://kairela.com  
**Current production:** https://job-agent-mu-steel.vercel.app  
**Development branch:** `feat/kairela-product-v1`  
**Last updated:** 2026-07-13 (Phase 0 audit)

---

## Vision

Transform the current release candidate (Signal / Job Agent) into **Kairela** — a polished, personalized, production-ready AI Career and Hiring Operating System for job seekers, employers, recruiters, and agencies.

---

## Phase Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 0 | Safe Release Setup | **Complete** | `de6fee0` master, `dbfd283` feat branch, docs committed |
| 1 | Complete Kairela Rebrand | Pending | Signal/Job Agent → Kairela, brand system, domain prep |
| 2 | Role-Based Conversational Onboarding | Pending | Job seeker, employer, recruiter, agency personas |
| 3 | Preference-Aware Job Discovery | Partial | Phase 15 added filtering; full pipeline in Phase 3 |
| 4 | Queue Reliability & Live Search | Partial | Phase 15 added priority, stages, stale recovery |
| 5 | Merged, Polished Pipeline UI | Partial | `job-search-workflow.tsx` integrated; polish in Phase 5 |
| 6 | Public Google Authentication | Partial | OAuth login fixed; full audit in Phase 6 |
| 7 | Email Authentication & Account Safety | Partial | Reset password, verify flow; full launch in Phase 7 |
| 8 | Mobile UX & Performance Pass | Pending | Lighthouse targets, safe areas, bundle reduction |
| 9 | Kairela AI Career Consultant | Pending | Context-aware assistant with tool actions |
| 10 | Proactive Relationship Manager | Pending | Recommendations, notifications, insights |
| 11 | Subscription & Entitlements | Pending | Plans behind feature flag |
| 12 | Employer / Recruiter / Agency Foundation | Pending | Feature-flagged foundation only |
| 13 | Landing, Reviews, Trust & Growth | Pending | Outcome-led landing, legal, SEO |
| 14 | Observability & Launch Operations | Pending | Admin console, alerts, structured logs |
| 15 | Final Release Candidate | Pending | Full audit, release gates, tagging |

---

## Execution Rules

1. Complete one phase at a time: audit → plan → implement → migrate → test → commit → push → deploy → verify.
2. Do not proceed while tests fail, migrations are unfinished, or critical regressions exist.
3. Preserve working auth, queue, ATS, browser automation, Google integration, and deployment architecture unless change is required.
4. Use feature flags for unfinished or high-risk features.
5. Never use localhost fallbacks in production E2E tests.
6. No placeholder implementations, fake progress, or fabricated user data.

---

## Phase 0 Baseline (2026-07-13)

### Git

| Item | Value |
|------|-------|
| Branch (pre-dev) | `master` |
| Local commits ahead of origin | 2 (`7725aa4`, `1c4a546`) |
| Uncommitted work | Phase 14–15 auth, preferences, queue (to be committed) |
| Remote | `https://github.com/Jack160699/job-agent.git` |
| Rollback target (last tagged RC) | `1c4a546` — `release: v0.2.0-rc.1` |
| Rollback deployment | `dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr` |

### Production

| Item | Value |
|------|-------|
| URL | https://job-agent-mu-steel.vercel.app |
| Deployment ID | `dpl_24ByW34mUwYYcQymp5M8WiVDzeBa` |
| Commit (deployed, dirty) | `7725aa4` + uncommitted local changes |
| Health | `ok` — DB connected, Supabase/OpenAI/cron configured |
| Queue | pending 1, running 0, completed 51, failed 8, cancelled 108 |

### Database (Supabase)

| Item | Value |
|------|-------|
| Project | `rcnigoakmxzlqipsaqvu` (ap-south-1) |
| Migrations applied | `20260712000000_initial_schema`, `20260712191812_phase15_preferences_queue` |
| ORM | Prisma 6.x |

### Infrastructure

- **Vercel:** `job-agent` (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`)
- **GitHub:** Jack160699/job-agent
- **OpenAI:** configured
- **Google Cloud OAuth:** configured (auth + integrations)
- **Playwright:** production E2E against `job-agent-mu-steel.vercel.app`

---

## Working Features (Pre-Kairela)

- Supabase email/password auth with verification gate
- Continue with Google (Supabase OAuth)
- Password reset flow
- Dashboard: jobs, applications, resumes, cover letters, settings, analytics
- Job search pipeline with ATS adapters (Greenhouse, Lever, Ashby, Workday, etc.)
- Preference-aware filtering and match scoring (Phase 15)
- Background job queue with interactive priority and progress stages
- Resume tailoring and cover letter generation (truthful AI policy)
- Google Workspace integrations (Gmail, Drive, Sheets, Calendar) — incremental scopes
- Browser automation worker framework
- Mobile-first dashboard shell with bottom navigation
- Production Playwright suite (`e2e/production-audit.spec.ts`, `e2e/phase15.spec.ts`)

---

## Known Limitations (Pre-Kairela)

1. **Branding:** Product still labeled Signal / Job Agent
2. **Domain:** `kairela.com` not yet attached; Vercel URL is canonical in production
3. **Onboarding:** Basic preferences page; not conversational or role-based
4. **Employer/recruiter/agency:** Not implemented
5. **AI consultant:** Not implemented
6. **Subscriptions:** Not implemented
7. **Observability:** Basic health endpoint; no admin ops console
8. **Progress UX:** Polling-based; not SSE/WebSockets
9. **Theme:** Dark-only; light mode tokens exist but toggle not wired
10. **Lint:** Pre-existing ESLint errors in unrelated files (38 issues at Phase 0 audit)
11. **Queue history:** Large cancelled backlog from prior stuck-state cleanup

---

## Success Criteria (Final Release)

- Kairela brand live on kairela.com (or verified redirect from Vercel URL)
- New user completes onboarding and finds relevant jobs for their profile
- Google and email auth verified in production E2E
- Search completes with real progress (no indefinite 5% stall)
- AI consultant explains current state safely
- Zero skipped/flaky critical-path production tests
- WCAG AA, mobile-first, Lighthouse targets met
- No exposed secrets; RLS enforced
