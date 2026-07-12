# Kairela Release Checklist

Use this checklist at the end of each phase and for the final release candidate (Phase 15).

---

## Phase 0 — Safe Release Setup

- [x] Confirm branch, Git status, production commit, deployment health
- [x] Record rollback target (`1c4a546` / `dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr`)
- [x] Commit and push uncommitted Phase 14–15 work (`de6fee0` on `master`)
- [x] Create branch `feat/kairela-product-v1` (`dbfd283`)
- [x] Create `docs/KAIRELA_PRODUCT_ROADMAP.md`
- [x] Create `docs/KAIRELA_ARCHITECTURE.md`
- [x] Create `docs/KAIRELA_RELEASE_CHECKLIST.md`
- [x] Record working features, limitations, schema, architectures
- [x] No production behavior changes in this phase

**Phase 0 production verification (baseline):**

| Check | Result | Timestamp |
|-------|--------|-----------|
| `/api/health` status | `ok` | 2026-07-12T20:09:20Z |
| Database | connected | ✓ |
| Queue pending | 1 | ✓ |
| Queue running | 0 | ✓ |
| Deployment | `dpl_24ByW34mUwYYcQymp5M8WiVDzeBa` | ✓ |

---

## Per-Phase Gate (Phases 1–14)

Before marking a phase complete:

- [ ] Focused implementation plan documented
- [ ] Code implemented and reviewed
- [ ] Database migrations applied (if any)
- [ ] Unit tests added/updated
- [ ] Production Playwright tests added/updated
- [ ] `npm run lint` — no new critical errors introduced
- [ ] `npm run build` — passes
- [ ] `npm test` — passes
- [ ] `npm run test:e2e:rc` — passes against production URL
- [ ] Commit with meaningful message
- [ ] Push to remote
- [ ] Deploy to production
- [ ] Verify production (health + phase-specific checks)
- [ ] Record results in roadmap doc

---

## Phase 1 — Kairela Rebrand

- [x] All Signal / Job Agent references replaced
- [x] Brand system (colors, typography, logo, favicon, manifest)
- [x] `kairela.com` / `www.kairela.com` configuration (code + www redirect)
- [x] Canonical URL handling updated
- [x] OAuth redirect URLs updated
- [x] Vercel URL remains fallback
- [ ] kairela.com DNS attached in Vercel (pending domain verification)
- [x] robots.txt, sitemap, manifest verified on production

---

## Phase 2 — Onboarding

- [ ] Role/persona model and migrations
- [ ] Conversational onboarding UI
- [ ] Continuous save, resume parsing review
- [ ] Profile completion percentage
- [ ] Employer/agency behind feature flags
- [ ] RLS policies verified

---

## Phase 3 — Preference-Aware Discovery

- [ ] Match classifications (strong/possible/low/rejected)
- [ ] Excluded jobs secondary view
- [ ] Legacy job archival
- [ ] Profile verification: Pune FE, remote India, entry analyst, senior US

---

## Phase 4 — Queue Reliability

- [ ] Claim latency < 10s (normal conditions)
- [ ] Real progress stages (not timer-based)
- [ ] Stale recovery, dead-letter, admin queue page
- [ ] All required timestamps populated

---

## Phase 5 — Pipeline UI

- [ ] Desktop coherent layout
- [ ] Mobile sticky strip / bottom sheet
- [ ] All states: queued, running, complete, failed, cancelled, stale
- [ ] 44px tap targets, safe areas

---

## Phase 6 — Google Auth

- [ ] Login: openid + email + profile only
- [ ] Integrations: incremental scopes in Settings
- [ ] Account linking verified
- [ ] Client secret not in repo/history
- [ ] Production Playwright auth tests

---

## Phase 7 — Email Auth

- [ ] Verification required before active account
- [ ] Resend, cooldowns, expired link recovery
- [ ] Password strength, rate limits
- [ ] Kairela-branded email templates

---

## Phase 8 — Mobile & Performance

- [ ] All pages audited on SE, 15, Pixel, Samsung, iPad, desktop
- [ ] Landing Lighthouse performance ≥ 95
- [ ] Accessibility ≥ 96
- [ ] No layout overlap on mobile nav

---

## Phase 9 — AI Consultant

- [ ] Floating action (desktop) / bottom sheet (mobile)
- [ ] Tool/action architecture with confirmation for mutations
- [ ] Context: profile, jobs, search, page awareness
- [ ] Safety: no fabrication, no unauthorized sends

---

## Phase 10 — Relationship Manager

- [ ] Proactive recommendations with explain-why
- [ ] Notification inbox, dismiss/snooze
- [ ] Frequency limits, quiet hours, opt-out
- [ ] Market insights labeled as estimates

---

## Phase 11 — Subscriptions

- [ ] Plan model, entitlements, usage ledger
- [ ] Billing behind feature flag
- [ ] No raw card data stored
- [ ] Provider abstraction documented

---

## Phase 12 — Employer Foundation

- [ ] Feature-flagged employer/recruiter/agency modes
- [ ] Candidate privacy: private by default
- [ ] No unauthorized scraping or spam outreach

---

## Phase 13 — Landing & Growth

- [ ] Outcome-led landing page
- [ ] No fabricated testimonials
- [ ] Legal pages (privacy, terms, cookies, AI disclosure)
- [ ] SEO, sitemap, structured data
- [ ] Consent banner if required

---

## Phase 14 — Observability

- [ ] Structured logs, error tracking
- [ ] Queue/worker/auth alerts
- [ ] Admin ops console (secured)
- [ ] Backup/recovery documentation

---

## Phase 15 — Final Release Candidate

### Test categories

- [ ] Unit
- [ ] Integration
- [ ] Production Playwright (0 skipped critical, 0 flaky)
- [ ] Mobile visual regression
- [ ] Accessibility
- [ ] Performance (Lighthouse)
- [ ] Auth (Google + email)
- [ ] Onboarding
- [ ] Preference filtering
- [ ] Queue timing
- [ ] Match scoring
- [ ] Resume/cover letter/PDF
- [ ] Google Workspace integration
- [ ] AI consultant
- [ ] Entitlements
- [ ] Security / RLS
- [ ] Domain redirects

### Release gates

- [ ] No localhost in production references
- [ ] No exposed secrets
- [ ] No critical console errors in tested flows
- [ ] No stuck queue states
- [ ] New user: onboard → relevant jobs
- [ ] Google signup works
- [ ] Email verify + sign-in works
- [ ] Search completes with relevant results

### Deliverables

- [ ] `RELEASE.md` updated
- [ ] `CHANGELOG.md`
- [ ] `docs/LAUNCH_RUNBOOK.md`
- [ ] `docs/ROLLBACK_RUNBOOK.md`
- [ ] `docs/SUPPORT_RUNBOOK.md`
- [ ] `docs/SECURITY_REVIEW.md`
- [ ] `docs/PRIVACY_DATA_MAP.md`
- [ ] Git tag for stable release
- [ ] Merge `feat/kairela-product-v1` → `master`

---

## Rollback Quick Reference

```bash
# Promote previous Vercel deployment
npx vercel promote dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr --yes

# Verify health
curl https://job-agent-mu-steel.vercel.app/api/health
```

**Do not** run destructive database operations during rollback. Code rollback first; assess schema compatibility.
