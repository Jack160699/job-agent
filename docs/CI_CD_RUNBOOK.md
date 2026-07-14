# CI/CD Runbook

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `release-validation.yml` | Push/PR to platform branches | Lint, typecheck, unit, security tests, build, secret scan |

## Local commands

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:security
npm run verify:release
npm run test:e2e:smoke    # requires E2E_TEST_EMAIL/PASSWORD
npm run test:e2e:rc       # full RC, zero retries
```

## Required secrets (CI)

No real production credentials in CI. Use placeholder Supabase URLs and test-only encryption keys as defined in the workflow env block.

## Required secrets (production)

- `ENCRYPTION_KEY` / `OAUTH_STATE_SECRET`
- `BROWSER_WORKER_TOKEN`
- `CRON_SECRET`
- `DATABASE_URL`, Supabase keys
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` (CI/E2E only, not in repo)

## Migrations

Apply Supabase migrations in order before deploy:

```bash
# via Supabase CLI or scripts/apply-migration.js
supabase/migrations/20260715100000_rate_limits.sql
```

## Preview deploy

Push `feat/kairela-platform-completion` and verify Vercel preview URL before merging.
