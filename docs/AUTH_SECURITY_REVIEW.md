# Auth Security Review

## Email authentication

- Supabase Auth handles signup, login, verification, password reset.
- Middleware protects `/dashboard/*` routes.
- Verification gate enforced before dashboard access.

## Google identity (login)

- Handled by Supabase OAuth (`components/auth/google-auth-button.tsx`).
- Callback: `app/auth/callback/route.ts` exchanges code, provisions DB user.
- **Fixed**: `next` redirect parameter validated via `isSafeInternalRedirect()` — blocks `//evil.com` and absolute URLs.

## Google Workspace integrations (Gmail, Drive, Sheets, Calendar)

Separate from login OAuth. Uses `lib/google/oauth.ts`.

### State security (fixed)

| Control | Implementation |
|---------|----------------|
| Cryptographic signing | HMAC-SHA256 with `OAUTH_STATE_SECRET` or `ENCRYPTION_KEY` |
| Expiration | 10-minute TTL |
| Nonce / replay | In-process nonce store; rejected on reuse |
| Session binding | Callback requires `getDbUser()` matches `state.userId` |
| Feature allow-list | Only `gmail`, `drive`, `sheets`, `calendar` accepted |
| Fail closed | Unsigned/legacy state rejected with reason codes |

### Initiation

`GET /api/google/oauth` requires authenticated session (`resolveApiUser`).

## API auth patterns

| Helper | Use |
|--------|-----|
| `resolveApiUser()` | Production-sensitive routes (import-link, Google OAuth, browser) |
| `resolveApiUserDev()` | Legacy product APIs — dev-only `dev@localhost` fallback |
| `isAdminUser()` | Admin queue |

**Recommendation**: migrate remaining `resolveApiUserDev` callers to `resolveApiUser`.

## Rate limiting

Auth-related presets: 20 req/min for Google OAuth initiation.

## Manual actions

- Enable Supabase leaked-password protection in dashboard
- Configure additional MFA methods
- Rotate historical shared E2E test account password
