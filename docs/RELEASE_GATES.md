# Release Gates

All gates must pass before merging to the stable production branch.

## Automated gates

- [ ] `npm run lint` — zero errors
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run test:unit` — all pass
- [ ] `npm run test:security` — OAuth state + browser worker auth tests pass
- [ ] `npm run build` — production build succeeds
- [ ] No conflict markers in tree
- [ ] No hardcoded credentials in tracked files
- [ ] Secret scan clean (CI workflow)
- [ ] Dependency audit reviewed (high severity addressed or accepted)

## Database gates

- [ ] All migrations applied to production Supabase
- [ ] RLS enabled on all public tables
- [ ] `rate_limit_buckets` table exists (migration `20260715100000`)

## Security gates

- [ ] `BROWSER_WORKER_TOKEN` set in Vercel + worker runtime
- [ ] `OAUTH_STATE_SECRET` or `ENCRYPTION_KEY` set
- [ ] Google OAuth callback rejects unsigned/expired/replayed state
- [ ] Browser MCP bridge fails closed without token in production
- [ ] Auth callback rejects external `next` redirects

## E2E gates (pre-release)

- [ ] `npm run test:e2e:smoke` with valid E2E credentials
- [ ] `npm run test:e2e:rc` — full RC suite, retries disabled
- [ ] Mobile journey spot-check on iPhone SE + Pixel viewport

## Manual gates (deferred)

- [ ] Domain attached (`kairela.com`) — owner approval required
- [ ] Final human acceptance test plan executed — owner approval required
- [ ] Rotate leaked historical E2E shared account password

## Rollback

Preserve https://job-agent-mu-steel.vercel.app deployment `7514afd` / `feat/kairela-product-v1` as rollback target until RC passes all gates.
