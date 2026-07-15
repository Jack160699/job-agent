# Browser Worker Security

## Architecture

- **App API**: `POST/GET /api/browser/tasks` — authenticated users enqueue/cancel tasks
- **Status**: `GET /api/browser/status` — authenticated; no public bridge URL leak
- **Worker**: `browser-worker/worker.ts` — polls `browser_tasks` via Prisma (service role)
- **MCP Bridge**: `browser-worker/automation/mcp-bridge-server.ts` — Playwright HTTP API

## Authentication

### Production requirements

1. Set `BROWSER_WORKER_TOKEN` in Vercel and on the worker host.
2. MCP bridge **exits on startup** if token missing in production (`NODE_ENV=production` or `VERCEL` set).
3. Bridge binds to `127.0.0.1` in production unless `BROWSER_MCP_BIND_HOST` overrides.
4. All bridge requests require `Authorization: Bearer <token>`.

### App → bridge

`BROWSER_MCP_BRIDGE_URL` health checks include the bearer token when configured.

## Authorization

- Users may only list/cancel their own tasks (`userId` match).
- Worker verifies `application.userId === task.userId` before preparation.

## Rate limiting

Browser task endpoints use `RATE_LIMIT_PRESETS.browserWorker` (40 req/min per IP).

## Key rotation

1. Generate new `BROWSER_WORKER_TOKEN`.
2. Update Vercel env + worker process env simultaneously.
3. Restart worker and redeploy app.
4. Old token invalid immediately after restart.

## Health checks

Bridge `/health` returns uptime only — no secrets. Requires auth in production.

## Local development

Without `BROWSER_WORKER_TOKEN`, bridge allows unauthenticated requests on `0.0.0.0` for local testing only.
