# Performance, ATS Intelligence, and Job-Search Reliability V1 — Implementation Record

Date: 2026-07-16
Branch: `feat/performance-ats-search-v1` (temporary, not merged to master)
Starting commit: `3f5fae438cdd9d716d0f208021315a55f4c314b8`
Backup branch: `backup/before-performance-ats-search-v1` @ `3f5fae438cdd9d716d0f208021315a55f4c314b8` (pushed)

This was an intentionally large, 14-phase brief. Given the scope, this pass
prioritized the pieces that were foundational, measurable, and testable —
the ATS scoring engine, instant resume processing, and job-search
reliability/performance — over broad, shallow coverage of every phase.
What was deferred is listed explicitly at the end, not silently dropped.

## Phase 1 — Measurement (code-level audit, not live production traces)

This sandbox has no access to a live database or production traffic, so
"baseline measurements" here are architectural evidence read directly from
the code, the same class of evidence that produced the task's own cited
"~66 second" claim latency finding — not synthetic benchmark numbers.

Findings, before this change:
- **Job search sources fetched sequentially** — a `for` loop over
  Greenhouse/Lever/Ashby/Workday adapters, each `await`ed in turn. A slow or
  hanging source (e.g. Workday) delayed every source behind it.
- **Job persistence was a classic N+1** — for every filtered/excluded job
  (potentially dozens), one `findFirst` (3-condition OR) plus a
  create-with-nested-relations or update, **plus** a `progress()` call per
  new job that itself did an extra `findUnique` + progress write. For N
  jobs this was roughly 4-6+ round trips each.
- **Interactive search kick already existed** (`after()` calling
  `processBackgroundJobs()`, plus a secondary remote self-fetch) but (a) the
  remote fetch's failures were silently swallowed, and (b) the in-process
  path drained the *entire* pending queue (up to 10 jobs per batch,
  sequentially) rather than claiming the one job that had just been
  enqueued — so a backlog of unrelated jobs could still delay the claim.
- **Resume upload awaited the OpenAI enrichment call before responding** —
  `buildCareerProfile()` called `enhanceCareerProfileWithAI()` synchronously
  in the request path.
- **Dashboard jobs query loaded up to 100 jobs per request with nested
  `applications.tailoredResume`/`applications.coverLetter` full bodies**
  (large `Text`/`Json` fields) even though the job-card UI only checks
  their truthiness for a badge.
- **`getDbUser()` had no per-request memoization** — every call site
  (layout, page, API route) re-ran the Supabase + Prisma lookup.

Instrumentation added (Server-Timing headers + structured fields), so these
claims are now measurable going forward without guessing:
- `/api/jobs/search`: `authResolutionMs`, `databaseQueryMs`,
  `queueCreationMs`, `queueClaimLatencyMs` (logged at claim time).
- `searchJobs()` (`src/lib/jobs/pipeline.ts`): `sourceFetchMs` per source,
  `deduplicationMs`, `filteringMs`, `persistenceMs`, `totalSearchMs` —
  returned in the result payload and written to the `JOB_SEARCH_COMPLETE`
  audit log.
- `/api/resumes/master`: `deterministicExtractionMs`, `totalMs`.

## Phase 2 — Navigation and performance (scoped)

Implemented:
- `getAuthUser`/`getDbUser` (`src/lib/auth/server.ts`) wrapped in React
  `cache()` — per-request memoization, no more repeated Supabase/Prisma
  round trips for the same request.
- Job list query (`getJobs` in `src/lib/data/dashboard.ts`): `take: 100` →
  `take: 20`; replaced full `applications.tailoredResume`/`.coverLetter`
  includes with a `select` returning only `{ id }` (the UI only checks
  truthiness). Added `getJobDetail(jobId)` for the full-relation fetch a
  job drawer/detail view should use instead.
- Added `loading.tsx` skeletons for `/dashboard/jobs`,
  `/dashboard/applications`, `/dashboard/settings` (previously only the
  dashboard root and `/dashboard/resumes` had one).
- Added dashboard-route prefetching (`AppShell`, on mount) for `/dashboard`,
  `/dashboard/jobs`, `/dashboard/resumes`, `/dashboard/applications`,
  `/dashboard/settings` — covers every entry path (password, Google,
  LinkedIn) since it lives in the shared shell, not the login form.

**Deferred** (see "Remaining limitations"): full cursor-based "Load more"
pagination UI (the query-level trim to 20 is done; the client-side
load-more control is not); a broader bundle-size/dynamic-import audit;
systematic optimistic-UI pass.

## Phase 3 — Instant resume processing

`POST /api/resumes/master` (`src/app/api/resumes/master/route.ts`) now:
1. Parses the file (unchanged, existing trusted path).
2. Runs deterministic extraction only (`extractCareerProfile`) — no AI call.
3. Computes the baseline `AtsReadinessScore` from that deterministic profile.
4. Persists resume + profile + score (`content.atsScore`,
   `content.enrichment.status`) and **returns immediately**.
5. If `OPENAI_API_KEY` is configured, schedules `enrichResumeInBackground()`
   via `after()` — this re-runs `enhanceCareerProfileWithAI` (unchanged,
   still grounded/fill-only-if-empty from Priority 1), recomputes the score
   against the enriched profile, and updates the stored resume. Failure
   just marks `enrichment.status: "failed"` — the deterministic result
   already stands on its own and was already shown to the user.

The UI (`resume-entry-screen.tsx` → `review-screen.tsx`, via a new
`AtsScoreCard`) shows the score immediately, with a small "refining in the
background" indicator while `enrichmentPending` is true.

## Phase 4 — Kairela ATS Readiness Score engine

`src/lib/resumes/ats-score.ts`, fully unit-tested
(`ats-score.test.ts`, 11 tests). Deterministic — no AI call, no randomness;
identical input always produces an identical score (asserted directly in
tests).

Categories and weights (sum to 100, verified by test):

| Category | Weight |
|---|---|
| Contact and identity completeness | 10 |
| Standard ATS sections | 10 |
| Work-experience structure | 15 |
| Skills clarity and categorization | 15 |
| Achievement and impact evidence | 15 |
| Readability and formatting safety | 10 |
| Date and timeline consistency | 10 |
| Education/certification completeness | 5 |
| Keyword clarity and role positioning | 10 |

Rating thresholds: **Strong** ≥ 80, **Good** 55–79, **Needs improvement**
< 55 — each with a plain-language explanation returned alongside the score
(`ratingExplanation`).

Returned shape: `totalScore`, `rating`, `ratingExplanation`, `categories[]`
(each with `score`/`maxScore`), `strengths[]`, `issues[]`, `quickFixes[]`,
`missingSections[]`, `formattingRisks[]`, `extractionConfidence`,
`scoreVersion` ("1.0.0"), `generatedAt`.

**Grounding**: the achievement-evidence category only reads
`experience[].description` (already-grounded, extracted text) for numbers
or action verbs — it never scans free-form/appended text for claims,
verified directly by a fabrication-prevention test. No category can ever
score a resume higher for a claim that doesn't already exist in the
extracted structure.

Copy explicitly avoids claiming this is an official ATS score — the UI
card states: *"This is Kairela's own readiness score, not an official
Workday, Greenhouse, Lever, Ashby, or LinkedIn score."*

## Phase 8 — Interactive job-search claim latency

`src/lib/jobs/background.ts`:
- Extracted the claim/execute/complete/fail logic (previously inline in the
  batch loop) into a shared `claimAndRunJob()`.
- Added `claimAndProcessJob(jobId)` — atomically claims and runs exactly
  one known job, using the same atomic `updateMany({status:"pending"})`
  claim semantics as the batch drain (idempotent, no duplicate-claim risk).
- `POST /api/jobs/search?async=true` now calls
  `after(() => claimAndProcessJob(job.id))` instead of
  `after(() => processBackgroundJobs())` — the fresh interactive search is
  claimed directly instead of waiting behind whatever else happens to be
  pending in the batch drain.
- `triggerWorkerRemote()` (the secondary self-fetch kick) now has a 4s
  timeout (`AbortController`) and logs `worker_trigger_remote_failed`
  instead of silently swallowing errors — a broken kick is now visible in
  logs instead of silently degrading every search to the cron fallback.
- `processBackgroundJobs()` (the batch drain) is unchanged in behavior and
  remains the recovery path — cron still runs it every 5 minutes
  (`vercel.json`, unchanged; not modified in this task given plan-tier risk
  of a tighter schedule not being deployable).

## Phase 9 — Parallel search sources

`searchJobs()` (`src/lib/jobs/pipeline.ts`): the sequential adapter loop is
now `Promise.allSettled` over up to `SOURCE_CONCURRENCY` (4) sources at
once — with today's 4 sources, this is fully parallel. Each source has its
own timeout (`JOB_SOURCE_TIMEOUT_MS` env override, default 10s) via a
`withTimeout()` wrapper so one hanging source can't block the others; all
existing per-source health-tracking, audit logging, and error handling is
preserved per-source (just no longer serialized). Per-source duration is
captured in `sourceFetchMs` and logged in a new
`JOB_SEARCH_SOURCES_COMPLETE` audit entry.

## Phase 10 — Search persistence N+1 removal

New `src/lib/jobs/job-matching.ts` (pure, fully unit-tested — 7 tests):
`buildJobLookup()`/`partitionByExistence()` replace the per-job `findFirst`
with one bulk `prisma.job.findMany` (OR over all candidates' identity
signals) plus O(1) in-memory lookup maps, exactly mirroring the original
three-way match (source+externalId → canonicalUrl → fingerprint).

`searchJobs()` now: bulk-fetches existing matches once, partitions filtered
+ excluded candidates into updates vs. creates, then:
- **Updates** run as one `$transaction` array (was: N sequential top-level
  `update()` calls), followed by one `$transaction` array of provenance
  upserts.
- **Creates** generate `crypto.randomUUID()` ids client-side and use three
  `createMany` calls (Job, Application, JobProvenance) inside one
  transaction — regardless of N, this is 3 bulk operations instead of N
  individual multi-table creates.
- The per-item `progress("saving", ...)` call (which itself cost 2 extra
  queries per item) was removed in favor of one progress call before the
  batch write.

No new indexes were added — the existing unique indexes
(`userId+source+externalId`, etc., from earlier workstreams) already cover
the bulk lookup's `OR` conditions; no query-plan evidence from this sandbox
justified adding new ones, and Phase 10 explicitly said to add indexes only
when evidence demonstrates the need.

## Phases 5, 6, 7, 11, 12 — status

- **Phase 5 (follow-up questions)**: already substantially satisfied by the
  Priority 1 resume-first onboarding preferences screen, which already
  asks only for fields missing from the resume. **Not done this pass**:
  making experience/education/projects/certifications individually
  editable in the review screen (they are currently read-only lists with
  chip-editable skills/job-titles only) — a real UI build, not attempted
  given remaining time, and explicitly listed below as a limitation rather
  than silently left as-is.
- **Phase 6/7 (job-specific ATS score, tailored before/after)**: **not
  implemented this pass.** The general Kairela ATS Readiness Score (Phase
  4) is a solid foundation a job-specific scorer could build on, but a
  correct, grounded job-specific match score plus a tailored-resume
  before/after comparison is a substantial second scoring engine — doing it
  hastily risked exactly the "invented qualification" failure mode the
  task explicitly prohibits. Deferred rather than rushed.
- **Phase 11/12 (search quality, progressive UX stages)**: not implemented
  this pass. The existing `evaluateJobAgainstPreferences`/location-handling
  code was audited but not changed; the existing `progress()` stage
  reporting already covers most of the named UX stages structurally
  (`discovering_sources`, `fetching_jobs`, `deduplicating`, `filtering`,
  `scoring`, `saving`, `completed`) but Retry/Cancel/Broaden controls and
  explicit "why zero results" messaging were not built this pass.

## Test results

| Suite | Before this task | After | Command |
|---|---|---|---|
| Unit (`vitest run`) | 245 passed | **263 passed** (+18: 7 job-matching, 11 ats-score) | `npm run test:unit` |
| Security | 23 passed | **23 passed** (unchanged) | `npm run test:security` |
| Migration contracts | 13 passed | **13 passed** (unchanged, no migration added) | `npm run test:rls` |
| Typecheck | pass | **pass** | `npx tsc --noEmit` |
| Lint | pass (pre-existing warnings) | **pass**, 0 errors, 2 new pre-existing-style warnings | `npm run lint` |
| Build | 61 routes | **61 routes** (no new routes; existing routes modified) | `npm run build` |

Playwright was not run against a live environment for the same reason as
prior tasks in this branch's history: no `DATABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
`E2E_TEST_EMAIL`/`PASSWORD` are available in this sandbox, and
`playwright.config.ts` only targets a real deployed URL.

## Remaining limitations

1. Experience/education/projects/certifications are still read-only in the
   onboarding review screen (Phase 5's explicit ask).
2. No job-specific ATS score or tailored before/after scoring (Phases 6/7).
3. No Retry/Cancel/Broaden search controls or "why zero results" UX copy
   (Phase 12); no location-synonym/India-first query work (Phase 11).
4. Job list pagination is trimmed at the query level (20 vs. 100) but has
   no client "Load more" control yet — the 21st+ job simply isn't fetched.
5. Cron drain frequency (5 minutes, `vercel.json`) was not tightened —
   changing it risks a plan-tier rejection on deploy; the interactive kick
   fix (Phase 8) is the real latency fix, cron is just the fallback.
6. No live production timing was captured (sandbox has no DB access) — the
   "before" evidence here is architectural/code-level, not measured
   wall-clock numbers; the new Server-Timing instrumentation makes real
   measurement possible once this deploys somewhere with traffic.

## Preview deployment

See the final chat report for deployment ID/URL — deployed via `vercel`
(no `--prod`) from `feat/performance-ats-search-v1`, not merged to master.
