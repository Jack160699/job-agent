# Kairela Platform Changelog

## 2026-07-15 — Workstream 0–1 (feat/kairela-platform-completion)

### Security
- Signed Google Workspace OAuth state (HMAC, expiry, nonce replay protection, session binding)
- Browser MCP bridge fails closed without `BROWSER_WORKER_TOKEN` in production
- Browser status/tasks endpoints require authentication; consistent 401 responses
- Auth callback blocks open-redirect via `next` parameter validation
- Postgres-backed durable rate limiting with per-route presets
- Rate limits added to consultant, recommendations, admin, Google OAuth routes

### CI / tooling
- GitHub Actions `release-validation.yml`
- Scripts: `test:unit`, `test:security`, `test:e2e:smoke`, `verify:release`, `typecheck`

### Documentation
- `docs/PRODUCT_PLATFORM_AUDIT.md`
- `docs/AUTH_SECURITY_REVIEW.md`, `docs/BROWSER_WORKER_SECURITY.md`
- `docs/CI_CD_RUNBOOK.md`, `docs/RELEASE_GATES.md`
- `docs/MANUAL_EXTERNAL_ACTIONS.md`
- Platform execution state tracking

### Migration
- `20260715100000_rate_limits.sql` — durable rate limit buckets table
