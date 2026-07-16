# Changelog

## Unreleased — 2026-07-16 — LinkedIn OIDC sign-in

- Added "Continue with LinkedIn" (official Supabase `linkedin_oidc`
  provider) alongside Google and email/password, feature-flagged off by
  default via `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED`.
- Safe account resolution: never creates a duplicate user for an existing
  verified email, never links on an unverified email, handles LinkedIn
  responses with no email via a dedicated `/auth/complete-email` flow.
- Only fills `fullName`/`avatarUrl` when empty — never overwrites a
  resume-confirmed profile, never infers career data from LinkedIn.
- New "Account" tab in Settings shows connected sign-in methods and lets
  users connect/disconnect LinkedIn, with unlink-your-only-method
  protection.
- See `docs/product/LINKEDIN_OIDC_AUTH.md` and
  `docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md`.

## Unreleased — 2026-07-16 — Resume-first onboarding

- Job-seeker onboarding now leads with resume upload; extraction is
  reviewed and edited before any job-search preferences are asked, and only
  preferences the resume couldn't answer are collected afterward.
- See `docs/product/RESUME_FIRST_ONBOARDING.md` and
  `docs/progress/RESUME_FIRST_ONBOARDING_IMPLEMENTATION.md`.

## [0.4.0-rc.1] — 2026-07-13 — Kairela Product V1

### Phase 1 — Rebrand
- Kairela brand system, PWA, SEO, domain preparation

### Phase 2 — Onboarding
- Role-based conversational onboarding with continuous save

### Phase 3 — Preference-aware discovery
- Match classifications, excluded jobs view, preference tests

### Phase 4 — Queue reliability
- Dead-letter status, admin queue ops, stale recovery

### Phase 5 — Pipeline UI
- Cancelled state handling, 44px tap targets on search actions

### Phase 6–7 — Authentication
- Password strength validation, verification resend cooldown

### Phase 8 — Mobile UX
- Safe-area aware consultant FAB, mobile progress strip

### Phase 9 — AI Career Consultant
- Floating consultant chat with context-aware responses

### Phase 10 — Proactive relationship manager
- Recommendations with dismiss/snooze and frequency controls

### Phase 11 — Subscriptions foundation
- Plan model, entitlements, usage ledger (billing feature-flagged off)

### Phase 12 — Employer foundation
- Feature-flagged hiring workspace preview

### Phase 13 — Landing and trust
- Privacy, terms, cookies pages (draft for legal review)

### Phase 14 — Observability
- Admin ops console, structured logging helper

### Phase 15 — Release candidate
- Runbooks, security/privacy docs, production E2E suite
