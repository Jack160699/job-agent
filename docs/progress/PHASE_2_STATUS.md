# Phase 2 — Role-Based Conversational Onboarding

**Status:** Complete  
**Branch:** `feat/kairela-product-v1`  
**Commit:** `7a4461c`  
**Started:** 2026-07-13

## Requirements

- Conversational multi-step onboarding for job seeker, employer, recruiter, agency
- Role selection: "What would you like Kairela to help you accomplish?"
- Progressive save, profile completion %, resume parse review
- Database: persona, onboarding state, hiring profile, preference history, consent
- Employer/agency behind feature flags
- RLS on new tables

## Implementation Plan

1. Prisma + Supabase migration for onboarding models
2. `src/lib/onboarding/` — steps, service, gate
3. `src/lib/feature-flags.ts`
4. `/api/onboarding` — GET/PUT with continuous save
5. `ConversationalOnboarding` UI component
6. Dashboard gate via `x-pathname` middleware header
7. Auth callback → onboarding for new users
8. Unit + E2E tests

## Files Added/Modified

- `prisma/schema.prisma` — UserPersona, OnboardingState, HiringProfile, PreferenceHistory, ConsentRecord
- `supabase/migrations/20260713100000_phase2_onboarding.sql`
- `src/lib/onboarding/steps.ts`, `service.ts`, `gate.ts`
- `src/lib/feature-flags.ts`
- `src/app/api/onboarding/route.ts`
- `src/components/onboarding/conversational-onboarding.tsx`
- `src/app/dashboard/onboarding/page.tsx`
- `src/lib/supabase/middleware.ts` — x-pathname header
- `src/app/dashboard/layout.tsx` — onboarding gate
- `src/app/auth/callback/route.ts` — new user redirect

## Verification

| Check | Result |
|-------|--------|
| Unit tests | 24/24 pass |
| Build | Pass |
| E2E phase2 | Auth redirect verified |
| Production deploy | `dpl_86ozndqEqgJBjYw9a95D42pDabk7` |

## Notes

- Employer/recruiter/agency personas hidden unless `FEATURE_*_MODE=true`
- EXPLORER completes without full job search preferences
- Job seeker requires master resume before completion
