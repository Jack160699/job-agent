# Codex Residual and CI Reconciliation

Date: 2026-07-16
Repository: `Jack160699/job-agent`
Canonical branch: `release/kairela-v1-rc`

This is the final Kairela repository-housekeeping checkpoint: preserving the
last uncommitted Codex landing-page work found on the frozen
`feat/kairela-product-v1` worktree, reconciling it onto the canonical branch,
and updating CI so `release/kairela-v1-rc` is validated. No product feature
(WS11 or otherwise) was implemented.

## Three original uncommitted files

Found via `git -C "C:\Users\shriyansh chandrakar\job apply agent" status --short`
— exactly these three, nothing else:

- `e2e/landing-page.spec.ts`
- `src/app/globals.css`
- `src/app/layout.tsx`

All three diffs together implement one coherent, self-contained feature: a
"Bricolage Grotesque" display typeface for `<h1>`/`<h2>` headings (Google
Font, loaded via `next/font/google`), plus a Playwright test asserting
headings use the display face while body copy stays in Geist.

## Backup branch

`backup/codex-uncommitted-landing-work`, created from `feat/kairela-product-v1`
HEAD (`e310f7e`), containing only the three files above.

- Commit: `1e75b61911eaca29f63da745d06d59ff4420ab15`
- Message: `backup(landing): preserve final uncommitted Codex changes`
- Pushed to `origin`; confirmed matching via `git rev-parse` on both local
  and `origin/backup/codex-uncommitted-landing-work`.
- Not deleted; recovery-only, per policy.

After the backup commit was pushed, the frozen worktree
(`C:\Users\shriyansh chandrakar\job apply agent`) was switched back to
`feat/kairela-product-v1` and confirmed clean
(`nothing to commit, working tree clean`).

## Per-file reconciliation

| File | Codex change | Canonical status | Decision | Reason |
|------|--------------|------------------|----------|--------|
| `src/app/layout.tsx` | Import `Bricolage_Grotesque` from `next/font/google`, define `KairelaDisplay` font with CSS variable `--font-kairela-display`, apply it alongside the existing `KairelaSans` variable on `<html className>` | Missing entirely — no display-font wiring existed | **Applied as-is** | Legitimate missing homepage improvement. This is the first use of `next/font/google` anywhere in the codebase (everything else uses `next/font/local`), so before applying I ran a full production build to confirm the Google Fonts fetch actually succeeds in this build environment — it compiled cleanly. No duplicate font loading (only one new font added), metadata/providers/auth untouched. |
| `src/app/globals.css` | Add `--font-display` Tailwind theme token; add a **global, unscoped** `h1, h2 { font-family: ...; font-optical-sizing: auto; }` rule | Missing entirely | **Partially applied — deviated from the raw diff** | The `--font-display` theme token was applied as-is (genuinely global, required for Tailwind `@theme inline` registration, no duplicate of anything already in `landing.css`). The unscoped `h1, h2` rule was **not** applied to `globals.css` as written: `src/app/page.tsx` wraps the entire homepage in a `.landing-page` div, and `landing.css` scopes every one of its rules under `.landing-page`. An unscoped `h1, h2` rule in `globals.css` would leak the display font into every heading app-wide, including the authenticated dashboard — exactly the "style leakage into authenticated pages" risk this task's reconciliation checklist calls out. Instead, the equivalent rule was added to `src/app/landing.css`, scoped as `.landing-page h1, .landing-page h2`, matching that file's existing convention. No old Signal/Job Agent styling was reintroduced; bottom-nav/safe-area rules in `globals.css` were untouched. |
| `e2e/landing-page.spec.ts` | Add a test asserting `h1` computed `font-family` contains "Bricolage" and `body` computed `font-family` contains "Geist" but not "Bricolage" | Missing entirely | **Applied as-is** | Legitimate test-only improvement. Uses `page.goto("/")` (relative), so it runs against whatever `baseURL` Playwright is configured with — no hardcoded deployment URL. Not a duplicate of any existing test in the file. Placed in the same position Codex had it, without touching the existing reduced-motion, mobile-viewport, keyboard/skip-link, or accessibility tests in the same file. |

Because the display-typography change is a genuine, intentional visual
change, it altered the rendered height of the homepage hero (headings now
render in the display face). This caused the two pre-existing Playwright
visual-baseline screenshots (`landing-desktop-1440.png`,
`landing-mobile-393.png`) to go stale (20611px → 20674px on mobile, similar
on desktop) — not a regression, but the expected effect of the reconciled
feature. Baselines were regenerated with the repository's own
`npm run test:landing:update` script and re-verified with a clean
`npm run test:landing` run (10/10 passed, see Test results below).

### Additional file touched beyond the three (documented deviation)

`src/app/landing.css` — added the scoped `.landing-page h1, .landing-page h2`
rule (see table above). This was necessary to safely reconcile the
`globals.css` change without leaking styles into authenticated pages; it was
not one of the three original uncommitted files, but no alternative existed
that met the task's own safety requirement.

## CI trigger changes

`.github/workflows/release-validation.yml`:

- `push.branches`: added `release/kairela-v1-rc` (now first/primary); kept
  `feat/kairela-platform-completion` and `feat/kairela-product-v1` for
  historical-validation continuity, per the task's explicit allowance.
- `pull_request.branches`: replaced `feat/kairela-product-v1` with
  `release/kairela-v1-rc`; kept `master`.
- Added a `Migration-contract tests` step (`npm run test:rls`) — these tests
  only read local SQL migration files with `node:fs`, no database
  connection required, so this is a zero-new-infrastructure addition of an
  existing release gate that was missing from CI.
- Added `Install Playwright browsers` + a `Landing page smoke test` step
  (`npm run test:landing`) marked `continue-on-error: true`. This is
  intentionally **non-blocking**: `playwright.config.ts` (the default,
  full E2E config) is hard-locked to production URLs only and was not
  touched. `playwright.landing.config.ts` self-manages a local server and
  needs no database or auth, making it safe to run in CI, but it includes
  pixel-diff visual-baseline assertions that are inherently sensitive to
  the exact OS/font-rendering environment the baseline was captured in
  (this session captured them on Windows locally; CI runs
  `ubuntu-latest`). Rather than risk a permanently-red or flaky hard gate
  on day one, this step reports diagnostic signal without blocking the
  workflow — the same `continue-on-error: true` pattern the file already
  used for `npm audit`. Flagged as a manual owner action to promote to
  blocking once Linux-CI baselines are established.
- No `master` push trigger and no production-deployment step were added.
  CI remains validate-only.
- No credentials were placed in the workflow; the existing `env:` block
  already only contained synthetic placeholder values (e.g. a
  `.placeholder`-suffixed fake JWT, `ci-test-*` strings) — unchanged.
- YAML syntax validated with Python's `yaml.safe_load` — parses cleanly.

## Changes applied to the canonical branch

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/landing.css`
- `e2e/landing-page.spec.ts`
- `e2e/landing-page.spec.ts-snapshots/landing-desktop-1440-chromium-win32.png` (regenerated)
- `e2e/landing-page.spec.ts-snapshots/landing-mobile-393-chromium-win32.png` (regenerated)
- `.github/workflows/release-validation.yml`
- `docs/progress/KAIRELA_PLATFORM_EXECUTION_STATE.json` (current-state notes only)
- `docs/progress/CODEX_RESIDUAL_AND_CI_RECONCILIATION.md` (new, this file)

## Changes intentionally not applied

- The unscoped `h1, h2` rule in `globals.css` as Codex originally wrote it
  (see table above — applied scoped in `landing.css` instead).
- No change to `playwright.config.ts` (production-only E2E config) — out of
  scope and unrelated to the three Codex files.
- No change to `.github/workflows/release-validation.yml`'s `env:` secrets
  handling — already correct (placeholders only).

## Test results (canonical worktree, after reconciliation)

| Check | Result | Baseline | Match |
|---|---|---|---|
| Lint | Pass — 4 pre-existing warnings, 0 errors | — | — |
| Typecheck | Pass, 0 errors | — | — |
| Unit tests | 169 passed | 169 passed | Exact match |
| Security tests | 23 passed | 23 passed | Exact match |
| Migration-contract tests | 13 passed | 13 passed | Exact match |
| Production build | Pass, 58 routes | 58 routes | Exact match |
| Landing-page regression + accessibility (`npm run test:landing`) | 10 passed (after regenerating 2 stale visual baselines caused by the intentional font change) | — | — |

No test was weakened. The two visual-baseline failures encountered mid-task
were resolved by regenerating the baseline images (via the repo's own
`test:landing:update` script) to reflect the new, correct, intentional
appearance — not by loosening assertions or skipping the tests.

## Preview deployment

Application code changed, so a preview deployment was created per policy.

- Command: `vercel --yes --cwd "C:\Users\shriyansh chandrakar\kairela-v1-rc"` (no `--prod`)
- Deployment ID: `dpl_A6aXjgiB6XbeHQZNuoQNYhCVYBvC`
- Preview URL: `https://job-agent-m2rbnnbgi-jack160699s-projects.vercel.app`
- `vercel inspect` confirms: `name: job-agent`, `target: preview`, `status: Ready`
- Build inside the deployment generated the same 58 routes as the local build.
- No deployment was created in `kairela-platform-completion` or
  `newspaper-motion`.

## Confirmation: production, master, and Supabase untouched

- `https://job-agent-mu-steel.vercel.app/` and `/api/health` both returned
  `200` before and after this task; `vercel --prod` was never invoked.
- `master` was not read from, written to, or merged into at any point in
  this task.
- No `supabase` CLI command was run (no migration apply/repair/push/reset;
  the remote database was not touched).
- `newspaper-motion` was never referenced or targeted by any command.
