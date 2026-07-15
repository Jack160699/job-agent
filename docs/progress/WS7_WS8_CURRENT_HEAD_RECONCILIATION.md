# WS7 / WS8 Current HEAD Reconciliation

Branch: `feat/kairela-platform-completion`  
Reconciled at: 2026-07-15  
Base commit at start: `2859d4e` (`fix(resumes): preserve tailored docs and ground tailor output`)

## Step 1 — HEAD and migration verification

| Check | Result |
|-------|--------|
| Branch | `feat/kairela-platform-completion` |
| Commit `2859d4e` present | Yes (ancestor of HEAD) |
| Working tree | Implementation changes in progress for reconciliation closure |
| Migration `20260715170000` present | Yes (`supabase/migrations/20260715170000_ws7_search_quality.sql`) |
| Migration order | Valid through `20260715180000` and `20260715190000` |
| Prisma generate | Succeeds |
| Remote DB apply evidence | **Not verified** — Vercel preview env lacked `DATABASE_URL`/`DIRECT_URL`; Supabase project not CLI-linked; Docker unavailable for local `supabase db` |

Exact apply command once credentials are available:

```bash
npx supabase db push --db-url "$DIRECT_URL"
# or apply SQL files in order through 20260715190000_resume_history_grounding.sql
```

External verification item: confirm schema.migrations / table presence for `search_plans`, `job_source_health`, `job_provenance`, nullable `tailored_resumes.master_resume_id`, `tailored_resume_versions`, and `jobs.saved_at`.

## Capability matrix

| Capability | Older audit finding | Current HEAD status | Evidence | Action |
|------------|----------------------|---------------------|----------|--------|
| Search plans generated | Missing plan object | Implemented | `buildUserSearchPlan` + `pipeline.ts` persist | Keep |
| Search plans persisted | Dead columns suspected | Connected | `prisma.searchPlan.create`, plan id in progress/audit/job analysis | Keep |
| Workers consume plans | Titles only | Connected | adapters use `filters.queries` via `discoveryQueries` | Keep |
| India / no SF default | Location leaks | Implemented + tested | `search-plan.test.ts`, `normalization.test.ts`, adapter query test | Keep |
| Source health tracking | Partial | Connected | pipeline upsert + rates | Keep |
| Source cooldown recovery | `disabledUntil` never written | Fixed | pipeline now persists cooldown; expired cooldown allows probe | Keep |
| Admin source diagnostics | Absent | Implemented | `/api/admin/search-sources` + admin ops table | Keep |
| Deduplication | Weak identity | Connected | `deduplication.ts` multi-key + provenance | Keep |
| Expiry handling | Partial | Connected | closes/removed/posted cutoff + EXPIRED status | Keep |
| Expired prepare/submit block | Missing | Fixed | application/process routes + `ApplicationActions` | Keep |
| Result views | Tabs only / wrong filters | Connected | `getJobsForView`; Possible excludes LOW; Saved uses `savedAt` | Keep |
| Feedback loop + undo | Present, isolation weak | Connected | user-scoped API + ranking; fail-closed E2E | Keep |
| Progress / stall retry | Stall left running | Fixed | stalled stops poll + clears running | Keep |
| Master delete preserves tailored | Cascade contradiction | Fixed in `2859d4e` + tests | SET NULL migration + history UI label | Keep |
| Grounding adversarial | Weak/string-only | Hardened | grounding-v2 report + adversarial unit tests | Keep |
| Resume History UX | Master-only snapshot | Launch-ready built | History UI, compare, archive/delete/restore, PDF endpoints | Keep |
| DOCX export | Requested | Deferred | PDF authorized endpoints only | Deferred — no DOCX renderer; documented in UI |
| Remote DB migration apply | Unknown | External blocker | Preview env / link unavailable | Owner verify |

## Residual risks / intentional deferrals

1. **Database migration application** must still be proven on the preview/production-compatible Supabase project.
2. **DOCX download** remains deferred; product clearly states PDF-only with durable IDs.
3. Authenticated Playwright journey coverage for full search/resume flows still depends on `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` against a live target; unauthenticated fail-closed specs are in-repo.

## Release actions covered here

- Master-delete safety tests/contracts
- Grounding evidence persistence + UI
- Resume History complete UX
- WS7 connectivity gaps from mid-implementation audits closed or deferred with reason
- Progress docs and preview deploy after gate
