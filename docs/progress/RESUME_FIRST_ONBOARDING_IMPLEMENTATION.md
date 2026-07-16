# Resume-First Onboarding — Implementation Record

Date: 2026-07-16
Branch: `release/kairela-v1-rc`
Starting commit: `e4e2e8b`
Backup branch: `backup/kairela-before-resume-first-onboarding` @ `e4e2e8b` (pushed)

See `docs/product/RESUME_FIRST_ONBOARDING.md` for the product/architecture
writeup. This document records what was built, verified, and deployed.

## Files added

Extraction and merge logic:
- `src/lib/resumes/career-profile.ts` — `ParsedCareerProfile` schema +
  deterministic extractor
- `src/lib/resumes/career-profile.test.ts`
- `src/lib/resumes/career-profile-ai.ts` — AI-assisted enhancement, grounded
  and fail-safe
- `src/lib/resumes/career-profile-ai.test.ts`
- `src/lib/onboarding/merge-policy.ts` — safe merge/conflict policy
- `src/lib/onboarding/merge-policy.test.ts`

Analytics:
- `src/lib/analytics/events.ts` — allow-listed, PII-scrubbing event helper
- `src/app/api/analytics/onboarding/route.ts`

UI (scoped to resume-first onboarding only):
- `src/components/onboarding/resume-first/tokens.ts` — scoped design tokens
- `src/components/onboarding/resume-first/types.ts`
- `src/components/onboarding/resume-first/resume-entry-screen.tsx`
- `src/components/onboarding/resume-first/review-screen.tsx`
- `src/components/onboarding/resume-first/preferences-screen.tsx`
- `src/components/onboarding/resume-first/chip-list-editor.tsx`
- `src/components/onboarding/resume-first/chip-list-editor.test.tsx`
- `src/components/onboarding/resume-first/preferences-screen.test.tsx`

Tests:
- `e2e/resume-first-onboarding.spec.ts`

Docs:
- `docs/product/RESUME_FIRST_ONBOARDING.md`
- `docs/progress/RESUME_FIRST_ONBOARDING_IMPLEMENTATION.md` (this file)

## Files modified

- `src/lib/onboarding/steps.ts` — `OnboardingStepId` union reduced to
  `welcome | resume | review | preferences | hiring_basics | complete`;
  `JOB_SEEKER_STEPS` reordered resume-first; `OnboardingDraft.resumeSkipped`
  added; `computeCompletionPct` updated for the skip path.
- `src/lib/onboarding/steps.test.ts` — updated for the new step sequence.
- `src/lib/onboarding/service.ts` — added `resolveEntryStep`,
  `computeReviewMerge`, `confirmReview`; made `completeOnboarding` idempotent
  (short-circuits without re-writing consent/preference-history rows when
  already complete).
- `src/app/api/onboarding/route.ts` — `GET` now calls `resolveEntryStep`;
  `PUT` gained `skip_resume`, `review_preview`, `confirm_review` actions;
  removed the old regex-based `parse_resume` action (superseded by the
  trusted `/api/resumes/master` path).
- `src/app/api/resumes/master/route.ts` — `POST` now also runs career-profile
  extraction (deterministic + optional AI) and persists it into
  `MasterResume.content.profile` and the existing `experience`/`education`/
  `projects` columns; both `GET` and `POST` return `profile` in the response.
- `src/lib/resumes/parser.test.ts` — added empty-file, oversized-file, and
  magic-byte-mismatch coverage.
- `src/components/onboarding/conversational-onboarding.tsx` — rewritten to
  orchestrate `resume → review → preferences → complete` for job seekers via
  the new components, while leaving `welcome` (persona choice) and
  `hiring_basics` (hiring persona flow) intact and visually unchanged.

## Database migration status

**No migration required or created.** All persistence reuses existing
columns (`MasterResume.content/experience/education/projects`,
`User.fullName/currentLocation/linkedinUrl/githubUrl/portfolioUrl`,
`UserSettings.currentRole/jobTitles/experienceYears/requiredSkills/...`).
Verified against `prisma/schema.prisma` before implementation — no schema
changes were made, so there is nothing pending to review or apply.

## Existing-user / skip-path behavior

- Users who already completed onboarding are never redirected back into it
  (`ensureOnboardingComplete`, unchanged).
- Users who completed onboarding before this change keep their data;
  `resolveEntryStep` only fires while onboarding is still incomplete.
- `completeOnboarding` is now idempotent: a repeated `action: "complete"`
  call (e.g. from a page refresh mid-transition) returns the existing state
  without creating duplicate `ConsentRecord`/`PreferenceHistory` rows or
  re-touching `MasterResume`.
- The skip path stores `resumeSkipped: true` and routes to a `preferences`
  screen that asks the baseline fields a resume would have answered, in
  addition to search preferences. Resume upload stays available afterward
  from Resume History, Settings, or "Upload a different resume" on the
  review screen.

## Security and privacy controls

- Reused the existing trusted parser (file-type sniffing, size limits, empty
  rejection) and rate limiting — nothing weakened.
- AI extraction is grounded (drops any value not literally present in the
  resume text) and fails silently to the deterministic result if
  `OPENAI_API_KEY` is absent or the call errors.
- Analytics events are allow-listed and metadata-sanitized server-side
  before being written to `AuditLog`; no resume text, names, emails, or
  phone numbers are logged.
- `requireReview: true` / `autoSubmitEnabled: false` remain the defaults for
  every profile; auto-submit requires an explicit, clearly-labeled opt-in.
- No public file storage was introduced; uploads continue to flow through
  the existing authenticated, rate-limited API into the database.

## Test results

Baselines are the numbers stated in the task; "new" is this change's delta.

| Suite | Baseline | Result | Command |
|---|---|---|---|
| Unit (`vitest run`) | 169 passed | **199 passed** (44→46 files) | `npm run test:unit` |
| Security | 23 passed | **23 passed** (unchanged, none removed) | `npm run test:security` |
| Migration contracts | 13 passed | **13 passed** (unchanged, no migration added) | `npm run test:rls` |
| Typecheck | pass | **pass** | `npx tsc --noEmit` |
| Lint | pass (pre-existing warnings) | **pass**, 0 new warnings/errors | `npx eslint src` |
| Build | 58 routes | **59 routes** (+`/api/analytics/onboarding`) | `npm run build` |

New unit/component test files (30 new tests total):
- `career-profile.test.ts` (10) — grounded extraction, dedup, no-fabrication,
  ambiguous-date guarding, education/experience parsing.
- `career-profile-ai.test.ts` (3) — fabrication-prevention grounding filter,
  graceful no-credentials fallback.
- `merge-policy.test.ts` (8) — empty-fill, confirmed-value preservation,
  conflict detection/resolution, array-order-insensitive equality.
- `chip-list-editor.test.tsx` (3), `preferences-screen.test.tsx` (3) —
  component-level: dedup on add, remove, safe defaults
  (`requireReview` on / `autoSubmitEnabled` off), conditional field
  visibility.
- `parser.test.ts` (+3) — empty file, oversized file, magic-byte mismatch.
- `steps.test.ts` — updated in place for the new step sequence (no count
  change).

## Playwright coverage

`e2e/resume-first-onboarding.spec.ts` was written covering all 12 required
scenarios (new user sees resume first; fixture PDF upload via a
`pdf-lib`-generated in-memory PDF; processing/extraction visible; edit a
field; confirm review; answer missing preferences; reach `/dashboard/jobs`;
refresh doesn't restart onboarding; continue-without-resume; existing
completed user not redirected; 320px mobile viewport with no horizontal
overflow and ≥44px tap targets).

**Not executed in this environment.** This sandboxed session has no
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or
`E2E_TEST_EMAIL`/`PASSWORD` — the credentials `e2e/helpers/auth.ts` needs to
create/clean up ephemeral test users and the shared E2E account. `playwright.config.ts`
also refuses to target `localhost` by design (Playwright here always drives a
real deployed URL). See "Owner actions" below.

## Preview deployment

Command run: `vercel` (no `--prod`) from the canonical worktree, linked to
project `job-agent` (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`).

**Important pre-existing gap surfaced by this task** (already tracked in
`docs/progress/KAIRELA_PLATFORM_EXECUTION_STATE.json` →
`manualOwnerActions`: "Confirm DATABASE_URL/DIRECT_URL on preview/production
Vercel envs"): `vercel env ls` shows `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured for **Production only**, not
**Preview**. That means the preview deployment created for this change can
be verified visually and for build correctness, but any route that touches
the database will error at runtime until the owner adds those variables to
the Preview environment (or provisions a separate preview database). This
is not something this task changed or should change unilaterally — wiring a
shareable preview URL directly to the production database is a decision for
the project owner.

Deployment ID, URL, and status are reported in the final summary of this
task's conversation.

## Owner actions

1. **Configure Preview-environment env vars** (`DATABASE_URL`, `DIRECT_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY` is already set for
   Preview) so preview deployments are DB-functional — pre-existing tracked
   item, now blocking full verification of this feature specifically.
2. Run `e2e/resume-first-onboarding.spec.ts` against the preview URL with
   `PLAYWRIGHT_BASE_URL`, `E2E_TEST_EMAIL`/`PASSWORD`, and
   `SUPABASE_SERVICE_ROLE_KEY` set, once (1) is done.
3. Decide whether to enable the AI-assisted extraction path in production by
   confirming `OPENAI_API_KEY` cost/rate-limit expectations for resume
   uploads — it is optional and already fails safe without it.
4. Review the review-screen UX decision to keep experience/education/project
   entries read-only in this pass (see "Remaining limitations") and
   prioritize inline entry editing if needed before wider rollout.
5. When ready, merge to `master` and promote via the normal release process
   — this task intentionally stops short of that.
