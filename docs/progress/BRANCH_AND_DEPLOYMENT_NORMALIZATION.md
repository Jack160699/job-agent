# Branch and Deployment Normalization

Date: 2026-07-16
Repository: `Jack160699/job-agent`

This is a repository/deployment hygiene operation only. No product code was
changed beyond what was required to keep the canonical branch green (none
was required — see Tests and build below), no Supabase schema was touched,
and no branch was deleted, force-pushed, or merged into `master`.

## Original branch state

| Item | Value |
|---|---|
| Working branch on arrival | `feat/kairela-product-v1` |
| HEAD on arrival | `e310f7e` (up to date with `origin/feat/kairela-product-v1`) |
| Uncommitted files present | `e2e/landing-page.spec.ts`, `src/app/globals.css`, `src/app/layout.tsx` — pre-existing Codex landing-page work, left untouched throughout |
| Unresolved merge/rebase/cherry-pick | None (`.git/MERGE_HEAD`, `rebase-merge`, `rebase-apply`, `CHERRY_PICK_HEAD` all absent) |
| Existing worktrees | `job apply agent` (`feat/kairela-product-v1` @ `e310f7e`), `kairela-platform-completion` (`feat/kairela-platform-completion` @ `3b5e6ff`) |
| `origin` remote | `https://github.com/Jack160699/job-agent.git` (confirmed) |
| `master` | Separate, at `9d84cb1`, untouched |

## Ancestry verification

```
git merge-base --is-ancestor abb29eec e310f7e   -> true (homepage)
git merge-base --is-ancestor 094c00d e310f7e    -> true (WS9)
git merge-base --is-ancestor 3b5e6ff e310f7e    -> true (WS10)
git merge-base --is-ancestor 12eacc2 e310f7e    -> true (combined merge)
```

All four expected ancestry relationships held, so normalization proceeded.

## Combined branch HEAD

`e310f7e1c98b9487aa0faabcaee23a09bd711f1d` — same commit already verified in
the prior migration-deployment session (`docs/progress/WS9_WS10_MIGRATION_DEPLOYMENT.md`).

## Backup branches (recovery only, never move these)

| Branch | SHA |
|---|---|
| `backup/kairela-combined-before-normalization` | `e310f7e1c98b9487aa0faabcaee23a09bd711f1d` |
| `backup/kairela-platform-before-normalization` | `3b5e6ff93367441e4ec1fa6b456f49b6d8890af6` |

Both pushed to `origin` and confirmed matching by direct `git rev-parse`
against the remote refs.

## Canonical branch

`release/kairela-v1-rc` created from `e310f7e`, pushed with upstream
tracking. `git rev-parse release/kairela-v1-rc` and
`git rev-parse origin/release/kairela-v1-rc` both resolve to
`e310f7e1c98b9487aa0faabcaee23a09bd711f1d`.

## Canonical worktree

`C:\Users\shriyansh chandrakar\kairela-v1-rc` — branch
`release/kairela-v1-rc`, HEAD `e310f7e`, clean working tree at creation.

The two prior worktrees remain in place, untouched, for historical
reference:
- `C:\Users\shriyansh chandrakar\job apply agent` (`feat/kairela-product-v1`, now frozen — still carries the 3 pre-existing uncommitted Codex landing files)
- `C:\Users\shriyansh chandrakar\kairela-platform-completion` (`feat/kairela-platform-completion`, now frozen)

## Vercel project linkage

`.vercel/project.json` in the new worktree:

```json
{"projectId":"prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J","orgId":"team_UWCzHaOLdAOtezWqRxYNxdYf","projectName":"job-agent"}
```

Linked via `vercel link --yes --project prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J --team team_UWCzHaOLdAOtezWqRxYNxdYf`
(non-interactive; team ID confirmed via `vercel whoami` as `jack160699`,
resolving to `jack160699s-projects/job-agent`). `.vercel/` remains
git-ignored (`.gitignore:54`) and was never staged or committed.

## Deployment policy

See `docs/REPOSITORY_AND_DEPLOYMENT_POLICY.md` (new). Summary: `master`
untouched until launch approval; `release/kairela-v1-rc` is the only active
branch; `feat/kairela-product-v1` and `feat/kairela-platform-completion` are
frozen historical; `job-agent` is the only Vercel project for new
deployments; `vercel --prod` remains forbidden without explicit owner
approval.

## Files changed

Committed on `release/kairela-v1-rc`:
- `docs/REPOSITORY_AND_DEPLOYMENT_POLICY.md` (new)
- `docs/progress/BRANCH_AND_DEPLOYMENT_NORMALIZATION.md` (new, this file)
- `docs/progress/KAIRELA_PLATFORM_EXECUTION_STATE.json` (current-state branch/worktree fields corrected; historical fields unchanged)
- `docs/progress/KAIRELA_PLATFORM_REMAINING_WORK.md` (branch/worktree header corrected, normalization entry added)
- `docs/progress/KAIRELA_PLATFORM_CHANGELOG.md` (normalization entry appended; no historical entries rewritten)
- `RELEASE.md` (branch and deploy-command corrected)

Audited, no change needed (no branch-name references found):
- `docs/MANUAL_EXTERNAL_ACTIONS.md`
- `CHANGELOG.md` (root)

Not committed (git-ignored or explicitly excluded by task rules):
- `.vercel/project.json`
- `node_modules/`, build output

Historical documents that mention `feat/kairela-product-v1` or
`feat/kairela-platform-completion` accurately (WS9/WS10 closure docs, phase
status docs, reconciliation docs, the CI workflow file, etc.) were **not**
rewritten, per the task's instruction to preserve accurate historical
records.

### Known follow-up not made (flagged, not executed)

`.github/workflows/release-validation.yml` still triggers only on pushes to
`feat/kairela-platform-completion` and `feat/kairela-product-v1`, not
`release/kairela-v1-rc`. Updating CI trigger branches was not in this task's
explicit file list and was treated as a CI/CD pipeline change requiring
separate owner confirmation rather than silently changed here. See
"Remaining owner actions" below.

## Tests and build (canonical worktree, after `npm install`)

| Check | Result | Baseline | Match |
|---|---|---|---|
| Lint | Pass — 4 pre-existing warnings, 0 errors | — | — |
| Typecheck | Pass, 0 errors | — | — |
| Unit tests | 169 passed | 169 passed | Exact match |
| Security tests | 23 passed | 23 passed | Exact match |
| Migration-contract tests | 13 passed | 13 passed | Exact match |
| Production build | Pass, 58 routes | 58 routes | Exact match |

No test counts changed; no application code was modified to achieve these
results (none was necessary).

## Preview deployment

- Command: `vercel --yes --cwd "C:\Users\shriyansh chandrakar\kairela-v1-rc"` (no `--prod`)
- Deployment ID: `dpl_7jF57tr88eZrgEFaoHpNPTmwwo58`
- Preview URL: `https://job-agent-wsiksj7yp-jack160699s-projects.vercel.app`
- `vercel inspect` confirms: `name: job-agent`, `target: preview`, `status: Ready`
- Build inside the deployment generated the same 58 routes as the local build.
- Route checks (`/`, `/login`, `/signup`, `/dashboard`, `/dashboard/jobs`,
  `/dashboard/resumes`, `/dashboard/applications`, `/privacy`, `/terms`) all
  returned `302` to `vercel.com/sso-api` — this is Vercel's standard
  Deployment Protection (SSO) gate on preview deployments for team
  projects, not an application error. It could not be bypassed without an
  owner-issued protection-bypass token or an authenticated browser session,
  neither of which this task provided. The identical 58-route Next.js build
  succeeding twice (local + Vercel build step) is the practical verification
  available without that credential.
- No deployment was created in `kairela-platform-completion` or
  `newspaper-motion` — the only `vercel` commands run in this session
  targeted the `job-agent`-linked worktree.

## Production status

`https://job-agent-mu-steel.vercel.app/` and `/api/health` both returned
`200` before and after this task. No production deployment or promotion was
made; `vercel --prod` was never invoked.

## Rollback procedure

1. To abandon `release/kairela-v1-rc` entirely and return to prior state:
   check out `backup/kairela-combined-before-normalization` (`e310f7e`) —
   identical content to the pre-normalization `feat/kairela-product-v1` HEAD.
2. To recover the pre-merge platform branch state:
   `backup/kairela-platform-before-normalization` (`3b5e6ff`) is pinned and
   untouched regardless of what happens to
   `feat/kairela-platform-completion` going forward.
3. No branch was deleted and no history was rewritten, so
   `feat/kairela-product-v1` and `feat/kairela-platform-completion` remain
   directly usable as-is if normalization needs to be reversed — no restore
   step is required for them.
4. The Vercel project `job-agent` was not modified in a way that requires
   rollback: only a new preview deployment was added (existing preview and
   production deployments are unaffected and remain listed under the
   project).

## Remaining owner actions

- Decide whether to update `.github/workflows/release-validation.yml` to
  trigger CI on `release/kairela-v1-rc` (not changed in this task — see
  "Known follow-up not made" above).
- Coordinate with Codex on moving in-progress landing-page work off the now
  frozen `feat/kairela-product-v1` onto `release/kairela-v1-rc`.
- All other outstanding owner actions are unchanged from
  `docs/MANUAL_EXTERNAL_ACTIONS.md` and
  `docs/progress/KAIRELA_PLATFORM_EXECUTION_STATE.json` (Supabase Auth
  hardening, `current_app_user_id()` search_path pin, production secrets,
  domain attach, Google OAuth live verification, Stripe activation) — none
  of these were touched by this normalization task.
