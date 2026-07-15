# Workstream 7 — Search Quality Audit

Date: 2026-07-15  
Branch: `feat/kairela-platform-completion`  
Baseline commit before gap work: `e91ca89`

## Scope audited

- Preference storage (`UserSettings` / dashboard settings)
- Search plan / query generation
- ATS adapters (`Greenhouse`, `Lever`, `Ashby`, `Workday`)
- Imported jobs
- Ranking / match classification
- Deduplication / expiry
- Feedback loop
- Source health
- Queue progress / cancellation / refresh resume
- Search-result UI

## Findings before WS7 gap completion

### High severity

1. Shared env board configuration leaked into every user’s search through `buildDiscoveryBoards()` and `boardsFor()`.
2. No explicit per-user search plan object explaining why queries were generated.
3. Location matching was substring-based and did not encode India-first alias groups (Bengaluru/Bangalore, Delhi NCR, India-remote vs worldwide remote).
4. Seniority quality was weak: fresher/lead/internship mismatches were warnings or soft scoring, not hard preference rejections with explanations.
5. Classification labels were numeric-score oriented (`STRONG_MATCH` …) and did not store an explicit classification version, uncertain factors, or hard rejection reasons in a durable shape.
6. Dedup used `source + externalId` only, so the same posting could reappear across ATS URLs.
7. Source health was not tracked, so repeatedly empty/failing boards could keep being requested.
8. Progress stages did not match the required user-facing search journey labels and did not publish failed-source summaries.
9. Results UI lacked separate Recommended / Possible / Saved / Imported / Excluded / Expired views and did not emphasize classification explanations over bare numeric scores.

### Medium severity

1. Feedback existed and affected ranking, but reason coverage was incomplete (missing industry/duplicate/expired/company-not-preferred) and undo only deleted feedback without clarifying saved-state restoration.
2. Closing-date / removed-posting expiry was incomplete; stale postedAt jobs were concerns rather than expired state transitions.
3. Currency-aware salary comparison could reject or accept incorrectly by comparing INR and USD as if the units matched.

### Working / already strong

1. Preference completeness gate prevents empty searches.
2. Background queue, cancellation, stale recovery, and refresh resume for search already exist.
3. Jobs are scoped by `userId` and RLS ownership patterns.
4. Feedback is per-user and was already consumed during ranking.
5. ATS adapters already pull real board postings instead of invented listings.

## Corrective work implemented in this WS7 pass

1. Explicit `UserSearchPlan` generation and durable `search_plans` storage.
2. India-first location and title/seniority normalization utilities with explanation strings.
3. Transparent `STRONG` / `POSSIBLE` / `LOW` / `REJECTED` classification with versioned factors.
4. User-scoped discovery boards only (no shared env board leakage).
5. Semantic / URL / fingerprint deduplication with provenance.
6. Per-user source-health tracking and temporary disablement.
7. Closing-date/removed/stale expiry transitions to `EXPIRED`.
8. Expanded feedback reasons + undo UI.
9. Separate result views and richer result cards.
10. Stage labels mapped to backend progress (plan → companies → sources → duplicates → evaluate → rank → prepare → complete).
11. Synthetic fixture profiles and dedicated unit/integration/E2E fail-closed coverage.

## Remaining residual risk

- Authenticated production search journey verification can still be blocked by external Supabase/Vercel entitlement limits.
- Remote adapters still depend on real target companies being configured for a useful hit rate.
- Currency conversion remains conservative: mismatched currencies become uncertainty rather than invented FX conversion.
