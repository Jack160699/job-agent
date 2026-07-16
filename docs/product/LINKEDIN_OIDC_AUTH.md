# LinkedIn OIDC Sign-In

Status: Implemented, feature-flagged off by default, live provider status **BLOCKED** (no Supabase dashboard credentials available to this change)
Branch: `release/kairela-v1-rc`
Scope: Authentication only — no LinkedIn profile scraping, no full career-data
import, no global redesign.

## Supported LinkedIn data

Read only from the Supabase-authenticated identity/user object, via the
official `linkedin_oidc` provider with scopes `openid profile email`:

- `sub` (LinkedIn's application-scoped member identifier) — used only by
  Supabase itself to key the identity; Kairela does not duplicate it in
  Prisma.
- `name` / `given_name` / `family_name` — only `name` (or `full_name`, for
  parity with Google) is ever read, and only to fill `User.fullName` when
  it is empty.
- `picture` — only to fill `User.avatarUrl` when it is empty.
- `email` / `email_verified` — used to resolve/link the Kairela account; see
  "User-resolution order" below. Both may be absent or `email_verified`
  may be `false`.
- `locale` — not persisted anywhere.

## Unsupported / intentionally not captured

- No restricted LinkedIn Profile API scopes are requested
  (`r_basicprofile`, `r_liteprofile`, connections, messages, jobs,
  employment history, education, etc.) — LinkedIn OIDC does not expose
  these, and this task does not add a separate LinkedIn API integration.
- No public LinkedIn profile URL (`linkedin.com/in/...`) is stored or
  guessed. OIDC does not return one, and the subject identifier must never
  be used to construct one.
- No current role, location, skills, employment, education, or project data
  is inferred from LinkedIn. That information continues to come only from
  the resume-first onboarding flow (Priority Product Upgrade 1).
- No OAuth provider access or refresh token is stored in Prisma, cookies
  accessible to client JS, or `localStorage`. Session tokens live only in
  Supabase's own secure, httpOnly cookie-backed session (via `@supabase/ssr`),
  unchanged from the existing Google flow.
- No "LinkedIn verified" identity badge is shown anywhere — LinkedIn OIDC
  does not verify a person's real-world identity, and the product never
  claims otherwise.
- No claim is made, anywhere in copy or code, that Kairela imported the
  user's LinkedIn profile.

## Authentication architecture

`src/components/auth/social-auth-button.tsx` is a single shared component
(`SocialAuthButton`) for both `google` and `linkedin_oidc`, replacing the
previous Google-only `GoogleAuthButton`. Provider metadata (label, icon,
enabled state) lives in `src/lib/auth/social-providers.ts`. Icons are inline
SVG (`src/components/auth/social-icons.tsx`) — never hotlinked.

```ts
supabase.auth.signInWithOAuth({
  provider: "linkedin_oidc",
  options: {
    redirectTo: `${window.location.origin}/auth/callback?next=/dashboard&provider=linkedin_oidc`,
  },
});
```

`redirectTo` is always built from `window.location.origin` plus a fixed,
hardcoded path — never from user input — so it cannot become an open
redirect regardless of environment (localhost, preview, or production).

The callback (`src/app/auth/callback/route.ts`) is shared across Google,
LinkedIn, and email OTP/verification. It still performs the same PKCE code
exchange (`exchangeCodeForSession`) or OTP verification
(`verifyOtp`) as before, still validates `next` via the existing
`isSafeInternalRedirect`, and still honors `x-forwarded-host` the same way.
What changed: it no longer assumes the authenticated user has an email, it
routes user resolution through the new safe resolver (see below), and it
shows provider-specific failure copy instead of a Google-only hardcoded
string.

Errors are sanitized before being surfaced or logged:
- `src/lib/auth/provider-errors.ts` maps a provider id to safe, generic
  copy ("Google authentication could not be completed." /
  "LinkedIn authentication could not be completed." / a generic fallback)
  and classifies any raw Supabase/provider error message into a coarse
  category (`expired`, `access_denied`, `invalid_grant`, `network`,
  `unknown`) for logging — the raw message itself is never logged or shown
  to the user, and authorization codes/tokens are never logged.

## Email-present flow

1. User clicks "Continue with LinkedIn" → Supabase redirects to LinkedIn →
   LinkedIn redirects back to Supabase → Supabase redirects to
   `/auth/callback?code=...&next=/dashboard&provider=linkedin_oidc`.
2. The callback exchanges the code for a session (unchanged PKCE flow).
3. `resolveKairelaUser(user)` resolves/creates the Prisma User (see
   "User-resolution order").
4. `User.fullName`/`User.avatarUrl` are filled only if currently empty.
5. The existing `postAuthDestination()` sends a new/incomplete user to
   `/dashboard/onboarding` (resume-first onboarding still runs — LinkedIn
   never skips or pre-fills it) and a completed user to their normal
   destination.

## Email-missing flow

LinkedIn may return no `email` claim, or one with `email_verified: false`.
The callback never crashes, never synthesizes an email, and never loses the
authenticated Supabase session:

1. `resolveKairelaUser` returns `{ status: "email_missing" }` (no email at
   all) or `{ status: "email_unverified_conflict" }` (the email matches an
   existing Prisma user but isn't verified for this sign-in) instead of
   throwing or creating an incomplete row.
2. The callback redirects to `/auth/complete-email?next=<safe-next>`.
3. `src/app/auth/complete-email/page.tsx` is a server component that
   requires an authenticated Supabase session (redirects to `/login`
   otherwise) — there is no user-id input anywhere on this page, so it
   structurally cannot be used to change another account's email.
4. The client form (`complete-email-form.tsx`) calls
   `supabase.auth.updateUser({ email }, { emailRedirectTo: ".../auth/callback?next=..." })`.
5. Supabase emails a confirmation link; clicking it returns through the
   same `/auth/callback` (as an `email_change` OTP), at which point the
   user now has a verified email and resolution proceeds normally —
   creating the Prisma User (new user → resume-first onboarding) or
   returning them to their existing account.
6. Both the "no email" and "email conflicts with another unverified claim"
   cases show the same generic copy and the same generic error on failure
   ("We couldn't use that email...") — this is deliberate anti-enumeration:
   the page never reveals whether an entered email already belongs to
   another Kairela account.
7. The whole flow is refresh-safe: nothing is written until the user
   submits, and the page re-derives its state entirely from the current
   Supabase session on every load.

## User-resolution order

`src/lib/auth/resolve-user.ts` (orchestrator) +
`src/lib/auth/user-resolution-policy.ts` (pure decision logic, fully
unit-tested) replace both the previous `getOrCreateUser()` (used only by
the callback) and an unsafe email-based upsert that lived inline in
`getDbUser()` (`src/lib/auth/server.ts`, used on every authenticated page
load as a fallback). Both now share one resolver:

1. **Existing Prisma User matching `supabaseId`** — used as-is (repeated
   LinkedIn logins are idempotent; this is Supabase's own automatic
   identity linking doing its job when emails match and are verified on
   both sides, so this is also where that case lands).
2. **No usable email** → `email_missing`, routed to email completion.
3. **A different Prisma User already exists with this email** — only
   linked (its `supabaseId` updated to the new identity) if this
   authentication's email is verified
   (`user.email_confirmed_at`, or the raw per-identity `email_verified`
   claim as a fallback signal). If not verified, `unverified_email_conflict`
   is returned instead — the two Prisma users are never merged.
4. **Nothing matches** → a brand-new Prisma User is created.

## Duplicate prevention

Covered by `user-resolution-policy.test.ts` (pure decision matrix) and
`resolve-user.test.ts` (the verification-signal helpers). The previous
`getDbUser()` implementation would upsert-by-email **without checking
verification at all** — closing that gap was necessary once a second OAuth
provider (LinkedIn, where `email_verified` can legitimately be `false` or
absent) exists; it was a latent risk with Google too, just less likely to
be exercised in practice. No behavior changed for the common case (repeat
sign-in via any provider matches by `supabaseId` immediately).

## Account-linking behavior (Connected Accounts)

`src/components/dashboard/connected-accounts.tsx`, surfaced as a new
"Account" tab in Settings, uses `supabase.auth.getUserIdentities()` to show
Google / LinkedIn (only when the feature flag is on) / Email-password
connection state, and `supabase.auth.linkIdentity({ provider: "linkedin_oidc" })`
to let a signed-in user add LinkedIn manually.

- If Supabase's manual identity linking isn't enabled for the project,
  `linkIdentity()` returns an error; the UI detects this, hides the
  "Connect LinkedIn" action, and shows "Account linking isn't enabled for
  this project yet." instead of treating it as a code failure.
- Unlinking is gated by `src/lib/auth/identity-policy.ts`
  (`canUnlinkIdentity`, unit-tested): the Disconnect button is disabled
  whenever the identity being removed is the user's only remaining one, a
  confirmation dialog is always required, and Supabase's own
  `unlinkIdentity()` call enforces the same rule server-side as a second
  layer of defense.

## Connected-accounts behavior details

See the component above. `linkedin_identity_linked` / `_unlinked` analytics
events fire client-side around the link/unlink actions (never carrying the
LinkedIn subject id, email, or photo URL — see "Security controls").

## Security controls

- PKCE code exchange and OTP verification: unchanged, reused as-is.
- `next` redirect validation: unchanged (`isSafeInternalRedirect`), reused
  for both LinkedIn's `redirectTo` and the email-completion flow's
  `next`/`emailRedirectTo`.
- Forwarded-host handling: unchanged.
- No OAuth provider access or refresh token is ever written to Prisma,
  `localStorage`, or any client-readable storage.
- No LinkedIn scraping and no browser automation logging into LinkedIn —
  authentication is entirely delegated to Supabase's official OIDC flow.
- Error messages shown to users and written to logs are sanitized (see
  "Authentication architecture"); raw provider error text and OAuth
  codes/tokens are never logged.
- Analytics (`linkedin_auth_started/succeeded/failed`,
  `linkedin_email_completion_required`, `linkedin_identity_linked/unlinked`)
  are allow-listed server-side (`src/lib/analytics/events.ts`,
  `src/app/api/analytics/auth/route.ts`) and metadata-sanitized — no email,
  name, LinkedIn subject id, OAuth code/token, or photo URL is ever
  included.
- Cross-user isolation: every route resolves the authenticated user via
  Supabase's session (server-side cookies) and scopes all reads/writes to
  that user's own records; `resolveKairelaUser` never accepts a client-
  supplied user id.

## Feature flag

`NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED` (public, must stay `NEXT_PUBLIC_`-
prefixed to reach the browser bundle):

- Missing or `"false"` → the LinkedIn button is not rendered anywhere
  (login, signup, Connected Accounts), and the LinkedIn row is omitted from
  Connected Accounts entirely.
- `"true"` → the LinkedIn button and Connected Accounts row appear.

Kept **off** by default in `.env.example` and not set on the preview
deployment created by this task — see "Provider setup" below for what the
owner still needs to do before turning it on anywhere.

## Provider setup (owner action, not performed by this task)

1. Create a LinkedIn Developer application, associate it with a LinkedIn
   Page, and request the **"Sign In with LinkedIn using OpenID Connect"**
   product.
2. In LinkedIn's app settings, add the Supabase Auth callback URL:
   `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard → Authentication → Providers → **LinkedIn (OIDC)**,
   enable the provider and enter the LinkedIn Client ID/Secret (never in
   source control, never in Vercel `NEXT_PUBLIC_*` variables).
4. Add Kairela's preview and production application URLs to Supabase's
   redirect allow list.
5. Set `NEXT_PUBLIC_LINKEDIN_AUTH_ENABLED=true` only in the intended
   Vercel environment(s) once the above is verified.

## Redirect URLs

- App → Supabase: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/authorize?provider=linkedin_oidc&redirect_to=<origin>/auth/callback?next=...&provider=linkedin_oidc`
- Supabase → LinkedIn → Supabase (fixed, configured in LinkedIn's app
  settings): `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- Supabase → App: `<origin>/auth/callback?code=...` (PKCE) or
  `<origin>/auth/callback?token_hash=...&type=...` (OTP/email-change)

## Test results

See `docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md` for exact counts.

## Preview result / Live verification status

See `docs/progress/LINKEDIN_OIDC_IMPLEMENTATION.md`.

## Remaining owner actions

See "Provider setup" above and the implementation doc's "Owner actions"
section.
