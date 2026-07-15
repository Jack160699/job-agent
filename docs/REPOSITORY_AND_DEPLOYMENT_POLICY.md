# Repository and Deployment Policy

Effective: 2026-07-16
Repository: `Jack160699/job-agent`

This document is the canonical reference for which Git branch and which
Vercel project to use for Kairela work. It supersedes any prior document or
comment that names `feat/kairela-product-v1` or
`feat/kairela-platform-completion` as the active branch.

## Git branches

### `master`
Stable launch branch. Untouched until final owner-approved launch. Do not
merge into it without explicit approval.

### `release/kairela-v1-rc`
The only active branch for all remaining Kairela development and release
work. Created from `e310f7e` (the verified combined WS1–WS10 + homepage
history). All new commits, PRs, and preview deployments target this branch
going forward.

### `feat/kairela-product-v1`
Frozen historical branch. Contains the original homepage + product-v1 work
and the WS9/WS10 platform merge. No new work should land here — it is kept
for history and rollback reference only.

### `feat/kairela-platform-completion`
Frozen historical branch. Contains the original WS0–WS10 platform work
before it was merged into `feat/kairela-product-v1`. No new work should land
here.

### Backup branches
- `backup/kairela-combined-before-normalization` (pinned to `e310f7e`)
- `backup/kairela-platform-before-normalization` (pinned to `3b5e6ff`)

Recovery reference only. Never branch active development from these, and
never move them.

## Vercel projects

### `job-agent` (`prj_WZSlraHQN3JuxKJtVjSiSLo5EX8J`, team `team_UWCzHaOLdAOtezWqRxYNxdYf`)
The canonical Kairela Vercel project. All preview deployments and the
eventual production deployment happen here. Production URL:
`https://job-agent-mu-steel.vercel.app`.

### `kairela-platform-completion`
Historical temporary preview project used during platform development. Kept
for now; do not deploy new work into it.

### `newspaper-motion`
Unrelated project (Jan Darpan). Never deploy Kairela into it, never modify
it as part of Kairela work.

## Deployment rules

- `vercel` (no flags) creates a **preview** deployment. This is the default
  and expected command for verifying changes.
- `vercel --prod` is **forbidden** until explicit owner approval for launch.
- Pushing a feature or release branch to GitHub is not the same as merging
  to `master` — do not describe or treat a branch push as a production
  merge.
- The GitHub branch and the Vercel deployment environment (preview vs.
  production) are separate concepts; a branch push does not itself trigger
  a production deployment.
- A production deployment can technically originate from any branch, but
  project policy forbids promoting any deployment to production without
  explicit launch approval from the owner, regardless of source branch.
