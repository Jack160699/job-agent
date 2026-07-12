# Job Agent — Release Candidate

## Version

**0.2.0-rc.1**

## Commit SHA

| Reference | Value |
|-----------|-------|
| Pre-RC base commit | `b3938418ce12818296d2d73bb2d0dfb6a54dac03` |
| RC deployment ID | `dpl_BABPsjZ1kaUec6NtQKPZGP8ds2oe` |
| RC status | Deployed to production (uncommitted local changes included in deploy) |

> **Action required:** Commit and tag `v0.2.0-rc.1` before promoting to stable.

## Deployment URL

| Environment | URL |
|-------------|-----|
| **Production** | https://job-agent-mu-steel.vercel.app |
| Deployment inspect | https://vercel.com/jack160699s-projects/job-agent/BABPsjZ1kaUec6NtQKPZGP8ds2oe |

## Features (0.2.0-rc.1)

### Product & UX
- Premium landing page (hero, demo, features, how-it-works, testimonials, pricing, FAQ)
- Mobile-first dashboard (bottom nav, collapsible drawer sidebar, 44px tap targets)
- Design system with tokens, glass surfaces, reduced-motion support
- Responsive application cards on mobile

### Authentication
- Email verification required before dashboard access
- `/verify-email` page with resend flow
- Continue with Google (Supabase OAuth) on login/signup
- `/auth/callback` route for OAuth and email confirmation
- Middleware blocks unverified users

### Job Search & Agent
- Live job search progress panel (stage, progress bar, jobs found, ATS, logs, ETA)
- Immediate background job processing (no 6-hour cron wait)
- `/api/jobs/progress` endpoint for real-time status
- Enhanced audit logs per ATS adapter during search

### Integrations
- Google OAuth for Gmail, Drive, Sheets, Calendar
- OpenAI for resume tailoring, match scoring, cover letters
- ATS adapters: Greenhouse, Lever, Ashby, Workday
- Browser automation via queued worker on Vercel

### Quality
- Structured `ErrorCallout` component (what/why/fix/retry/logs)
- Enhanced `/api/health` with integration status checks
- Production-enforced Playwright config (no localhost fallback)

## Known Limitations

1. **Google One Tap** — Standard OAuth button only; GIS One Tap not implemented
2. **Light mode** — Tokens defined; theme toggle not wired (dark-only)
3. **Progress streaming** — 1.5s polling, not SSE/WebSockets
4. **Background job progress** — Inferred from audit logs, no native progress column
5. **Browser automation on Vercel** — Uses `queued_worker` mode; full form-fill requires browser worker process
6. **Pending background jobs** — 90 jobs in queue at RC audit time (cron processes periodically)
7. **Integrations page** — Lives under Settings tab, not a dedicated route
8. **Verified badge** — Not shown in profile UI

## Test Summary

### RC Audit Run — 2026-07-12

| Metric | Result |
|--------|--------|
| **Playwright production suite** | **55/55 passed (100%)** |
| Retries | 0 (no flaky tests detected) |
| Skipped | 0 |
| Failed | 0 |
| Duration | 7.8 minutes |
| Command | `npm run test:e2e:rc` |
| Target | `https://job-agent-mu-steel.vercel.app` |

### Unit Tests

| Suite | Result |
|-------|--------|
| Vitest | **20/20 passed** |

### Verification Checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Complete Playwright production suite | ✅ 55 passed |
| 2 | 100% pass rate | ✅ |
| 3 | No skipped tests | ✅ |
| 4 | No flaky tests (retries=0) | ✅ |
| 5 | No localhost app references in E2E | ✅ (fixture server only for ATS HTML) |
| 6 | Every test uses production deployment | ✅ enforced in `playwright.config.ts` |
| 7 | Environment variables verified | ✅ via `/api/health` |
| 8 | Browser automation | ✅ 4 platform tests + status endpoint |
| 9 | Google OAuth | ✅ sign-in UI + integrations API |
| 10 | OpenAI | ✅ configured in production |
| 11 | Supabase | ✅ configured + database connected |
| 12 | ATS adapters | ✅ Greenhouse, Lever, Ashby, Workday |
| 13 | Background jobs | ✅ cron auth + progress API + health count |

### Production Health (2026-07-12T12:44:29Z)

```json
{
  "status": "ok",
  "supabase": "configured",
  "database": "connected",
  "openai": "configured",
  "google_oauth": "configured",
  "encryption": "configured",
  "cron": "configured",
  "browser": "queued_worker",
  "version": "0.2.0-rc.1",
  "background_jobs_pending": 90
}
```

### Test Files

| File | Tests |
|------|-------|
| `e2e/app.spec.ts` | 11 |
| `e2e/browser/automation.spec.ts` | 5 |
| `e2e/full-workflow.spec.ts` | 3 |
| `e2e/google-auth.spec.ts` | 3 |
| `e2e/google-oauth.spec.ts` | 3 |
| `e2e/production-audit.spec.ts` | 30 |
| **Total** | **55** |

## Rollback Instructions

### Option A: Vercel Dashboard (recommended)

1. Open https://vercel.com/jack160699s-projects/job-agent
2. Go to **Deployments**
3. Find the previous stable deployment: `dpl_KFX6aqzLmytFanPuoXpdNXzWX8B3`
4. Click **⋯** → **Promote to Production**

### Option B: Vercel CLI

```bash
# List recent deployments
npx vercel ls

# Promote previous deployment to production
npx vercel promote job-agent-meilgvgah-jack160699s-projects.vercel.app --yes
```

### Option C: Git revert + redeploy

```bash
git revert HEAD
git push origin main
# Vercel auto-deploys from main
```

### Post-rollback verification

```bash
npm run test:e2e:rc
curl https://job-agent-mu-steel.vercel.app/api/health
```

## Environment Variables (Production)

| Variable | Required | Status |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (E2E) | ✅ |
| `DATABASE_URL` | Yes | ✅ |
| `DIRECT_URL` | Yes | ✅ |
| `OPENAI_API_KEY` | Yes | ✅ |
| `ENCRYPTION_KEY` | Yes | ✅ |
| `CRON_SECRET` | Yes | ✅ |
| `GOOGLE_CLIENT_ID` | Optional | ✅ |
| `GOOGLE_CLIENT_SECRET` | Optional | ✅ |
| `GOOGLE_REDIRECT_URI` | Optional | ✅ |
| `NEXT_PUBLIC_APP_URL` | Yes | ✅ |
| `JOB_SEARCH_*` boards | Optional | Configured |
| `BROWSER_*` | Optional | queued_worker mode |

## Promote to Stable

1. Commit RC changes: `git add -A && git commit -m "release: v0.2.0-rc.1"`
2. Tag: `git tag v0.2.0-rc.1`
3. Run `npm run test:e2e:rc` one final time
4. Rename version to `0.2.0` in `package.json`
5. Deploy: `npx vercel deploy --prod --yes`
6. Create GitHub release with this document
