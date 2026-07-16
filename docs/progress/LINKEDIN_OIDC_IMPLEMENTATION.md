# LinkedIn OIDC Sign-In — Implementation Record

Date: 2026-07-16
Branch: `release/kairela-v1-rc`
Starting commit: `b2a35db54195639807160e677506883c845e9390`
Backup branch: `backup/kairela-before-linkedin-oidc` @ `b2a35db54195639807160e677506883c845e9390` (pushed)

See `docs/product/LINKEDIN_OIDC_AUTH.md` for the product/architecture
writeup. This document records what was built, verified, and deployed.

## Files added

Shared social-auth architecture:
- `src/lib/auth/social-providers.ts` — provider config + flag gating
- `src/lib/auth/social-providers.test.ts`
- `src/components/auth/social-icons.tsx` — inline Google/LinkedIn SVGs (no hotlinking)
- `src/components/auth/social-auth-button.tsx` — shared `SocialAuthButton`
- `src/components/auth/social-auth-button.test.tsx`
- `src/lib/auth/provider-errors.ts` — sanitized provider error copy/classification
- `src/lib/auth/provider-errors.test.ts`

User resolution and profile bootstrap:
- `src/lib/auth/user-resolution-policy.ts` — pure decision logic
- `src/lib/auth/user-resolution-policy.test.ts`
- `src/lib/auth/resolve-user.ts` — DB orchestrator (replaces `getOrCreateUser`)
- `src/lib/auth/resolve-user.test.ts`
- `src/lib/auth/profile-bootstrap.ts` — fill-only-if-empty name/avatar merge
- `src/lib/auth/profile-bootstrap.test.ts`

Email-missing completion flow:
- `src/app/auth/complete-email/page.tsx`
- `src/components/auth/complete-email-form.tsx`
- `src/components/auth/complete-email-form.test.tsx`

Connected accounts:
- `src/components/dashboard/connected-accounts.tsx`
- `src/components/dashboard/connected-accounts.test.tsx`
- `src/lib/auth/identity-policy.ts` — unlink-safety decision logic
- `src/lib/auth/identity-policy.test.ts`

Analytics:
- `src/app/api/analytics/auth/route.ts` (extends `src/lib/analytics/events.ts`)

Tests:
- `e2e/linkedin-oidc-auth.spec.ts`

Docs:
- `docs/product/LINKEDIN_OIDC_AUTH.md`
- `docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md` (this file)

## Files modified

- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — use the shared
  `SocialAuthButton` for both Google and LinkedIn; provider-aware failure
  copy via `provider-errors.ts`; supporting LinkedIn copy shown only when
  the flag is on.
- `src/app/auth/callback/route.ts` — routes through `resolveKairelaUser`
  instead of the old email-assuming `getOrCreateUser`; redirects to
  `/auth/complete-email` on missing/unverified email instead of silently
  falling through; provider-aware, sanitized error redirects and logs.
- `src/lib/auth/server.ts` (`getDbUser`) — replaced an unsafe
  upsert-by-email (no verification check) with the same
  `resolveKairelaUser` resolver used by the callback, closing a latent
  account-merge risk.
- `src/lib/jobs/pipeline.ts` — removed `getOrCreateUser` (superseded, no
  longer referenced anywhere).
- `src/lib/feature-flags.ts` — added `linkedinAuth` reading
  `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED`.
- `src/lib/analytics/events.ts` — added `AUTH_ANALYTICS_EVENTS` and
  `trackAuthEvent`; extended the metadata allow-list with `provider`.
- `src/components/dashboard/settings-form.tsx` — added an "Account" tab
  rendering `ConnectedAccounts`.
- `e2e/helpers/auth.ts` — exported `getAdminClient` for reuse by the new
  LinkedIn spec.
- `.env.example` — documented `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED` (default
  `false`) and that the LinkedIn Client ID/Secret belong only in Supabase,
  never here.

## Files removed

- `src/components/auth/google-auth-button.tsx` — superseded by
  `SocialAuthButton`; had exactly two callers, both updated.

## LinkedIn data captured

`sub` (Supabase-internal identity key only, never duplicated in Prisma),
`name`/`full_name` → `User.fullName` (fill-only-if-empty), `picture` →
`User.avatarUrl` (fill-only-if-empty), `email`/`email_verified` → account
resolution only. See "Supported LinkedIn data" in the product doc.

## LinkedIn data intentionally not captured

Restricted Profile API scopes, public LinkedIn profile URL, current
role/location/skills/employment/education/projects, OAuth access/refresh
tokens. See "Unsupported / intentionally not captured" in the product doc.

## Email-present / email-missing flows

See the product doc's corresponding sections — summarized: email-present
resolves and routes immediately; email-missing (or present-but-unverified-
conflict) routes to `/auth/complete-email`, which requires the existing
authenticated session, asks for an email, sends a Supabase confirmation
link, and only resolves/creates the Prisma User after that link is used —
at which point the same callback logic applies uniformly.

## Duplicate-user prevention

`user-resolution-policy.ts`'s decision matrix (existing-by-id → email-
missing → link-by-verified-email → unverified-conflict → create-new) is
shared by both the callback and `getDbUser()`'s fallback path, so there is
exactly one place duplicate-prevention logic lives. Unverified email claims
are never used to merge two different Prisma users.

## Account-linking / Connected-accounts behavior

See the product doc. Manual linking uses `supabase.auth.linkIdentity()`;
unavailability (manual linking disabled in the Supabase project) is
detected and degrades to "display state only, hide the Connect action,
explain why" rather than being treated as a bug. Unlinking is blocked
client-side (button disabled) and server-side (Supabase's own guarantee)
whenever it would remove the user's only identity.

## Database migration status

**No migration required or created.** Provider identity (the LinkedIn
`sub`, verification state, raw claims) lives entirely in Supabase's own
`auth.identities`, accessed via `supabase.auth.getUserIdentities()` — never
duplicated into Prisma. Only `User.fullName` and `User.avatarUrl`
(pre-existing, already-nullable columns) are ever written, and only when
empty.

## Feature-flag behavior

`NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED` — confirmed via
`social-providers.test.ts` and `social-auth-button.test.tsx`: unset or
`"false"` hides the LinkedIn button and the Connected Accounts LinkedIn row
completely; exactly `"true"` shows them. Google is never gated by this
flag. Not set on the preview deployment created by this task (default off).

## Test results

Baselines are the numbers stated in the task; "new" is this change's delta.

| Suite | Baseline | Result | Command |
|---|---|---|---|
| Unit (`vitest run`) | 199 passed | **245 passed** (46→55 files) | `npm run test:unit` |
| Security | 23 passed | **23 passed** (unchanged, none removed) | `npm run test:security` |
| Migration contracts | 13 passed | **13 passed** (unchanged, no migration added) | `npm run test:rls` |
| Typecheck | pass | **pass** | `npx tsc --noEmit` |
| Lint | pass (pre-existing warnings) | **pass**, 0 new errors, 1 new pre-existing-style warning (unused policy-function parameter) | `npx eslint src` |
| Build | 59 routes | **61 routes** (+`/api/analytics/auth`, +`/auth/complete-email`) | `npm run build` |

New auth-focused unit/component tests (46 new tests):
- `social-providers.test.ts` (5), `social-auth-button.test.tsx` (5) — flag
  gating, provider-exact-match, safe redirect construction.
- `provider-errors.test.ts` (5) — provider param sanitization, safe copy,
  error-message classification (never the raw message).
- `user-resolution-policy.test.ts` (6) — the full decision matrix,
  including idempotent repeated login and refused unverified-email linking.
- `resolve-user.test.ts` (7) — email-usability and verification-signal
  helpers against fabricated Supabase user objects.
- `profile-bootstrap.test.ts` (7) — fill-only-if-empty merge, no fields
  beyond fullName/avatarUrl ever produced.
- `identity-policy.test.ts` (4) — unlink-only-login-method protection.
- `complete-email-form.test.tsx` (3) — safe redirect target, anti-
  enumeration error copy, confirmation state.
- `connected-accounts.test.tsx` (4) — connection-state display, flag
  gating, disabled disconnect on the only remaining identity.

## Playwright coverage

`e2e/linkedin-oidc-auth.spec.ts` covers all 10 required scenarios, with two
honest limitations documented in-line in the file:

- Scenarios 1–3 (button visibility, OAuth request shape) gracefully skip
  their LinkedIn-specific assertions when the flag is off on the target
  environment (it is off by default on this preview).
- Scenario 4 (email-present → resume-first onboarding) is exercised via a
  Supabase admin-generated magic-link OTP rather than a real LinkedIn OAuth
  completion — this proves the exact same post-exchange
  `resolveKairelaUser` → `postAuthDestination` logic LinkedIn-with-email
  would use, without needing real LinkedIn credentials.
- Scenario 5 (LinkedIn *without* an email) cannot be simulated through the
  Supabase admin API (every admin-side path requires an email) or without
  a real LinkedIn test app that omits the email scope's data. It is
  covered at the unit level instead
  (`user-resolution-policy.test.ts`'s `email_missing` case end-to-end
  through `resolve-user.test.ts`'s verification helpers) and would need a
  live LinkedIn test account to exercise end-to-end.

**Not executed in this environment**, for the same reason as the
resume-first-onboarding suite: no `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or
`E2E_TEST_EMAIL`/`PASSWORD` are available in this sandbox, and
`playwright.config.ts` only ever targets a real deployed URL.

## Preview deployment

Command run: `vercel` (no `--prod`) from the canonical worktree, linked to
project `job-agent` (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`). Deployment ID,
URL, and status are reported in the final summary of this task's
conversation. `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED` was **not** set on
Vercel by this task — the button stays hidden on the preview until the
owner explicitly enables it after completing provider setup.

## Live LinkedIn verification status: BLOCKED

This sandboxed session has no access to the Supabase Dashboard, the
Supabase Management API, or any LinkedIn Developer credentials, and cannot
determine whether the `linkedin_oidc` provider is configured in Supabase
Auth for this project. No LinkedIn login was attempted or simulated as
having "succeeded" — per instructions, a successful LinkedIn login is never
invented. This must be verified live by the owner after completing
"Provider setup" in the product doc, with `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED=true`
set on whichever environment they test against.

## Remaining limitations

- Live LinkedIn OAuth completion is untested end-to-end (see above).
- `getDbUser()`'s fallback-creation defaults (`jobTitles: []`,
  `locations: []`) now match `resolveKairelaUser`'s, whereas its previous
  inline logic used placeholder defaults (`["Software Engineer"]`,
  `["Remote"]`) that predated the onboarding flow. This is treated as a
  bugfix (removing an inconsistency between two resolution paths for the
  same concept) rather than a regression, since resume-first onboarding is
  now the source of these preferences.
- Connected Accounts' "hide Connect when manual linking is unavailable"
  path is implemented defensively (pattern-matching Supabase's error
  message) but not verified against a real disabled-manual-linking
  project, since that also requires live Supabase access.

## Owner actions

1. Complete LinkedIn Developer app + Supabase provider setup (see the
   product doc's "Provider setup" section) — Client ID/Secret go only in
   Supabase, never in this repo or in Vercel `NEXT_PUBLIC_*` variables.
2. Add Kairela's preview and production URLs to Supabase's redirect allow
   list.
3. Set `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED=true` only on the intended
   environment once (1) and (2) are done.
4. Run `e2e/linkedin-oidc-auth.spec.ts` against that environment with
   `PLAYWRIGHT_BASE_URL`, `E2E_TEST_EMAIL`/`PASSWORD`, and
   `SUPABASE_SERVICE_ROLE_KEY` set (same pre-existing gap as
   resume-first onboarding — Preview currently lacks DB/Supabase env vars;
   see `docs/progress/KAIRELA_PLATFORM_EXECUTION_STATE.json` →
   `manualOwnerActions`).
5. Perform one real, manual LinkedIn login against a non-production
   environment before enabling the flag anywhere users can reach it.
6. Confirm whether Supabase manual identity linking is enabled for this
   project; if not and it's wanted, enable it so "Connect LinkedIn" in
   Settings works for already-signed-in users.
