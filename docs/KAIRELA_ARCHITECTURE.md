# Kairela Architecture

**Product:** Kairela — AI Career and Hiring Operating System  
**Stack:** Next.js 16 (App Router) · Supabase Auth · PostgreSQL (Supabase) · Prisma · Vercel · OpenAI · Google APIs · Playwright

---

## System Overview

```mermaid
graph TB
    subgraph Client
        UI[Next.js Dashboard]
        Auth[Supabase Auth]
        Landing[Landing / Auth Pages]
    end

    subgraph API["Next.js API Routes"]
        Routes[REST API]
        Cron[Cron /api/cron]
        Worker[/api/jobs/worker]
        Health[/api/health]
    end

    subgraph Core["Application Core"]
        Pipeline[Job Pipeline]
        Preferences[Preference Filter]
        Background[Background Queue]
        Agent[Agent Orchestrator]
        AI[AI Modules]
    end

    subgraph Data
        Prisma[Prisma ORM]
        PG[(Supabase PostgreSQL)]
        RLS[Row Level Security]
    end

    subgraph External
        OpenAI[OpenAI API]
        ATS[ATS Adapters]
        GoogleAuth[Google OAuth - Auth]
        GoogleWS[Google Workspace APIs]
        BrowserWorker[Browser Worker]
    end

    Landing --> Auth
    UI --> Auth
    UI --> Routes
    Routes --> Pipeline
    Routes --> Background
    Cron --> Background
    Worker --> Background
    Background --> Pipeline
    Pipeline --> Preferences
    Pipeline --> AI
    Pipeline --> ATS
    Agent --> BrowserWorker
    Routes --> GoogleWS
    Auth --> GoogleAuth
    Prisma --> PG
    PG --> RLS
    AI --> OpenAI
```

---

## Authentication Architecture

### Email / Password

| Component | Path / Module |
|-----------|---------------|
| Login | `src/app/login/page.tsx` |
| Signup | `src/app/signup/page.tsx` |
| Verify email | `src/app/verify-email/page.tsx` |
| Forgot password | `src/app/forgot-password/page.tsx` |
| Reset password | `src/app/reset-password/page.tsx` |
| Auth callback | `src/app/auth/callback/route.ts` |
| Email verification helper | `src/lib/auth/verify.ts` |
| Middleware gate | `src/lib/supabase/middleware.ts` |

**Flow:**

1. User signs up → Supabase sends verification email.
2. Middleware blocks dashboard routes until `email_confirmed_at` is set (email provider).
3. OAuth users bypass email confirmation via `isUserEmailVerified()` — IdP verifies email.
4. `/auth/callback` exchanges code, provisions Prisma `User` row, sets session cookies.
5. Global sign-out via `signOut({ scope: "global" })` in app shell.

### Google Login (Authentication Only)

| Component | Path |
|-----------|------|
| Google button | `src/components/auth/google-auth-button.tsx` |
| Supabase provider | Google OAuth via Supabase Auth |
| Callback | `https://rcnigoakmxzlqipsaqvu.supabase.co/auth/v1/callback` |

**Scopes:** `openid`, `email`, `profile` only — no Gmail/Drive/Sheets/Calendar at login.

**Account linking:** Same email on password + Google accounts handled in callback route.

---

## Google Workspace Integration Architecture

Separate from authentication. Tokens stored encrypted in `encrypted_secrets`.

| Component | Path |
|-----------|------|
| OAuth client | `src/lib/google/oauth.ts` |
| Auth URL | `/api/google/oauth?scopes=gmail|drive|sheets|calendar` |
| Callback | `/api/google/callback` |
| Status | `/api/google/status` |
| Gmail | `src/lib/google/gmail.ts` |
| Drive | `src/lib/google/drive.ts` |
| Sheets | `src/lib/google/sheets.ts` |
| Calendar | `src/lib/google/calendar.ts` |

**Incremental authorization:**

- `gmail` → gmail.readonly, gmail.send
- `drive` → drive.file
- `sheets` → spreadsheets
- `calendar` → calendar.events

Tokens encrypted with AES-256-GCM (`src/lib/security/encryption.ts`). Declining integration scopes does not affect login.

---

## Queue Architecture

| Component | Path |
|-----------|------|
| Enqueue / claim / recover | `src/lib/jobs/background.ts` |
| Worker endpoint | `src/app/api/jobs/worker/route.ts` |
| Cron drain | `/api/cron?mode=drain` (every 5 min) |
| Cron schedule | `/api/cron?mode=schedule` (daily 06:00 UTC) |
| Progress store | `src/lib/jobs/job-progress-store.ts` |
| Progress API | `src/lib/jobs/progress.ts` |

**Job model:** `BackgroundJob` in Prisma with statuses: `pending`, `running`, `completed`, `failed`, `cancelled`.

**Key fields:** `priority`, `source` (`interactive` | `scheduled`), `queuedAt`, `claimedAt`, `startedAt`, `heartbeatAt`, `completedAt`, `failedAt`, `cancelledAt`, `progressStage`, `progressPercent`, `progressMeta`.

**Interactive search:** priority `100`, idempotent enqueue per user, remote worker trigger via `/api/jobs/worker` with `CRON_SECRET`.

**Stale recovery:** heartbeat timeout 3 min, running timeout 10 min → requeue or fail.

**Progress stages:**

1. Validating your search profile
2. Selecting job sources
3. Fetching current openings
4. Filtering by your preferences
5. Removing duplicates
6. Calculating match quality
7. Saving relevant opportunities
8. Preparing recommendations
9. Complete

---

## Job Discovery Pipeline

| Component | Path |
|-----------|------|
| Pipeline orchestration | `src/lib/jobs/pipeline.ts` |
| ATS adapters | `src/lib/jobs/adapters.ts` |
| Preference filter/score | `src/lib/jobs/preferences.ts` |
| Types | `src/lib/jobs/types.ts` |
| Search API | `src/app/api/jobs/search/route.ts` |
| Preferences API | `src/app/api/preferences/route.ts` |

**Flow:**

1. Validate user preferences (`preferencesComplete`).
2. Fetch from enabled ATS sources / discovery boards.
3. Filter by location, role, skills, salary, visa, excluded companies, match threshold.
4. Score and classify: strong / possible / low / rejected / missing info.
5. Save relevant jobs; archive legacy pre-preference records.
6. Store `matchAnalysis` JSON on each job.

**Important:** Global ATS board slugs are discovery sources only — never treated as user preferences.

---

## Browser / ATS Automation

| Component | Path |
|-----------|------|
| Browser task queue | `src/lib/browser/queue.ts` |
| Automation registry | `src/lib/automation/registry.ts` |
| Browser worker | `browser-worker/` |
| MCP bridge | `browser-worker/automation/mcp-bridge-server.ts` |

**Modes:** `queued_worker` on Vercel (tasks persisted, processed by worker process). Full form-fill requires external browser worker.

**ATS platforms:** Greenhouse, Lever, Ashby, Workday, company portals.

---

## Database Schema

### Core tables (Prisma → PostgreSQL)

| Table | Purpose |
|-------|---------|
| `users` | Application user (linked to Supabase via `supabase_id`) |
| `master_resume` | Canonical resume (required before auto-apply) |
| `tailored_resumes` | Job-specific resume versions |
| `cover_letters` | Generated cover letters |
| `jobs` | Discovered job listings with match data |
| `applications` | Application lifecycle |
| `settings` | User preferences and integration flags |
| `background_jobs` | Async work queue |
| `browser_tasks` | Browser automation queue |
| `encrypted_secrets` | OAuth tokens, credentials |
| `logs` | Audit log |
| `recruiters`, `interviews`, `emails` | CRM / comms |

### UserSettings (search profile)

Key fields: `jobTitles`, `experienceYears`, `salaryMin/Max`, `salaryCurrency`, `workModes`, `locations`, `visaSponsorshipRequired`, `requiredSkills`, `preferredSkills`, `matchThreshold`, `targetCompanies`, `excludedCompanies`, `industries`, `willingToRelocate`, `noticePeriodDays`, `preferencesComplete`, `onboardingCompletedAt`.

### Migrations

| Version | Name |
|---------|------|
| `20260712000000` | `initial_schema` |
| `20260712191812` | `phase15_preferences_queue` |

RLS policies defined in Supabase SQL migrations. Application uses Prisma with service role for server-side operations; user-scoped queries filter by `userId`.

---

## Deployment Architecture

| Item | Value |
|------|-------|
| Platform | Vercel |
| Project | `job-agent` |
| Production URL | https://job-agent-mu-steel.vercel.app |
| Target domain | https://kairela.com (Phase 1) |
| Build | `prisma generate && next build` |
| Crons | 5-min drain, daily schedule |
| Env validation | Zod schema (server startup) |

**Required env vars (representative):** `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ENCRYPTION_KEY`.

---

## Security Architecture

- **Auth:** Supabase JWT + cookie sessions (`@supabase/ssr`)
- **Authorization:** Server routes verify session; RLS on Supabase tables
- **Secrets:** AES-256-GCM encryption for stored tokens
- **Rate limiting:** IP-based on API routes (`src/lib/security/`)
- **Audit:** `AuditLog` model for sensitive actions
- **AI policy:** Truthful outputs only — no invented qualifications

---

## Testing Architecture

| Suite | Path | Target |
|-------|------|--------|
| Unit | `vitest` / `src/**/*.test.ts` | Local |
| Production E2E | `e2e/production-audit.spec.ts` | `job-agent-mu-steel.vercel.app` |
| Phase 15 E2E | `e2e/phase15.spec.ts` | Production URL |
| Helpers | `e2e/helpers/production.ts` | `PRODUCTION_URL` constant |

Production E2E enforces no localhost fallback.

---

## Rollback Procedure

1. **Vercel:** Promote previous production deployment:
   ```bash
   npx vercel promote dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr --yes
   ```
2. **Git:** Revert to tagged RC:
   ```bash
   git checkout 1c4a546
   ```
3. **Database:** Migrations are additive; rollback deployment code first. Do not drop tables without backup.
4. **Verify:** `curl https://job-agent-mu-steel.vercel.app/api/health`

**Safe rollback targets:**

| Reference | SHA / ID |
|-----------|----------|
| Last tagged RC | `1c4a546` (`v0.2.0-rc.1`) |
| RC deployment | `dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr` |
| Pre-Signal redesign | `b393841` |

---

## Planned Architecture Changes (Phases 1–15)

- **Phase 1:** Kairela brand tokens, kairela.com canonical URLs
- **Phase 2:** `user_role`, `onboarding_state`, persona models
- **Phase 9:** AI consultant tool/action layer
- **Phase 11:** `plan`, `entitlements`, `usage_ledger`
- **Phase 14:** Structured logging, error tracking, admin ops console
