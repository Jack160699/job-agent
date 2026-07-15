# Manual External Actions

Actions that require the repository owner or external services. Code and documentation are prepared; do not mark complete until executed.

## Urgent — security

### Rotate leaked E2E test account

A shared E2E password was previously committed to Git history. Even though it was removed from the tree:

1. Open Supabase Auth dashboard for project `rcnigoakmxzlqipsaqvu`.
2. Locate the shared test account (email used in historical E2E runs).
3. Reset password or delete the account.
4. Set new credentials only in environment variables: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
5. Never commit credentials again.

## Production secrets

Set in Vercel project `job-agent`:

| Variable | Purpose |
|----------|---------|
| `BROWSER_WORKER_TOKEN` | MCP bridge + worker authentication |
| `OAUTH_STATE_SECRET` | Google integration OAuth state signing (or reuse `ENCRYPTION_KEY`) |
| `ENCRYPTION_KEY` | Token encryption (32+ chars) |
| `CRON_SECRET` | Cron/worker API auth |

## Database

All migrations through `supabase/migrations/20260715220000_ws10_gmail_user_isolation.sql`
are applied to the linked Supabase project `rcnigoakmxzlqipsaqvu` as of
2026-07-16. Verify with `supabase migration list --linked`. See
`docs/progress/WS9_WS10_MIGRATION_DEPLOYMENT.md` for what was applied and
two pre-existing SQL bugs fixed along the way.

Follow-up migration needed (not created — out of scope for the deployment
session that found it): pin `search_path` on `public.current_app_user_id()`
(flagged by `supabase db advisors --type security` as
`function_search_path_mutable`).

## Supabase dashboard

- Enable leaked-password protection
- Configure additional MFA methods if required
- Resolve `exceed_egress_quota` if authenticated production testing is needed

## Deferred until explicit approval

### Domain launch (`kairela.com`)

See `docs/DOMAIN_LAUNCH_CHECKLIST.md` (to be created at Workstream 18).

### Final human acceptance testing

See `docs/FINAL_HUMAN_TEST_PLAN.md` (to be created at Workstream 18).

## Billing activation (when business-ready)

- Stripe and/or Razorpay merchant accounts
- Webhook endpoints and signing secrets
- Enable `FEATURE_BILLING` only after provider verification

## Google Cloud Console

- Verify OAuth redirect URIs include production callback URLs
- Workspace integration scopes approved for production use
