# WS9/WS10 Migration Deployment

Date: 2026-07-16
Branch: `feat/kairela-product-v1`
HEAD: `12eacc2` (merge of `feat/kairela-platform-completion` @ `3b5e6ff` into `feat/kairela-product-v1` @ `a303071`)
Linked Supabase project: `rcnigoakmxzlqipsaqvu`

## Pre-flight: unresolved merge

On arrival, the working tree had an in-progress, unresolved `git merge` of
`feat/kairela-platform-completion` (HEAD `3b5e6ff`, containing WS9 `094c00d`
and WS10 `3b5e6ff`) into `feat/kairela-product-v1` (HEAD `a303071`), with
conflicts in `package.json`, `package-lock.json`, and
`src/components/consultant/consultant-fab.tsx`. The owner confirmed
completing this merge. Resolution:

- `consultant-fab.tsx`: kept the `--bottom-nav-height`/`--safe-bottom` CSS
  variable convention (defined in `globals.css`, used project-wide) over the
  incoming raw `env()` duplicate.
- `package.json`: kept both branches' `test:landing*` and `test:e2e:smoke`
  scripts (additive, no conflict — all referenced files exist).
- `package-lock.json`: regenerated via `npm install --package-lock-only`
  from the merged `package.json` rather than hand-resolving.

Merge committed as `12eacc2`.

## Migration history drift found before applying

`supabase migration list --linked` showed only the very first migration
(`20260712000000`) matching between local and remote. Four "remote-only"
migrations existed with no corresponding local file:

| Remote version | Name |
|---|---|
| `20260712191812` | `phase15_preferences_queue` |
| `20260712205127` | `phase2_onboarding` |
| `20260712211312` | `phase9_11_consultant_subscriptions` |
| `20260714183929` | `secure_browser_tasks_and_functions` |

Comparing their `statements` (via `supabase db query --linked` against
`supabase_migrations.schema_migrations`) against the local files with the
same *names* but different (later) timestamps confirmed the SQL content was
equivalent — local migration files had been renumbered/renamed at some point
after being applied remotely. This was a bookkeeping drift, not a schema
conflict.

Fixed with a metadata-only repair (no DDL executed):

```
supabase migration repair --status reverted 20260712191812 20260712205127 20260712211312 20260714183929 --linked
```

After repair, `supabase db push --linked --dry-run` produced a clean,
forward-only plan of all 20 local migrations ending at
`20260715220000_ws10_gmail_user_isolation.sql`.

## Bugs found and fixed while applying (forward-only, no rollback)

`supabase db push` runs each migration file in its own transaction and
stops on the first error, so failures below caused zero partial damage —
each was fixed in place and the push resumed from the failed migration.

1. **Missing idempotency guards** (would error on tables/types/policies
   that already existed remotely under the old, pre-rename versions):
   - `20260713100000_phase2_onboarding.sql`: bare `CREATE TYPE user_persona`
     and 4 bare `CREATE POLICY` statements — wrapped in
     `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
   - `20260713120000_phase9_11_consultant_subscriptions.sql`: bare
     `CREATE TYPE subscription_plan`/`subscription_status` and 4 bare
     `CREATE POLICY` statements — same guard applied.

2. **`uuid = text` operator error** (pre-existing bug, unrelated to the
   rename): several migrations compared `users.supabase_id` (column type
   `uuid`) against `auth.uid()::text`, which has no valid `=` operator.
   Fixed by dropping the erroneous `::text` cast (both sides are `uuid`):
   - `20260715113000_proactive_recommendations_v2.sql`
   - `20260715130000_job_feedback.sql`
   - `20260715140000_resume_versions.sql`
   - `20260715150000_harden_legacy_rls.sql` (inside the
     `current_app_user_id()` helper function used by most owner-scoped RLS
     policies)

No `DROP TABLE`, `TRUNCATE`, or unguarded `DELETE`/`RENAME` was present in
any pending migration. All new tables enable RLS with an owner-scoped
policy. Checked for pre-existing duplicate `(user_id, gmail_id)` rows before
the WS10 unique-index migration — zero found.

## Result

`supabase migration list --linked` now shows local and remote in exact 1:1
agreement, ending at `20260715220000`.

- RLS enabled on all 16 WS7/WS9/WS10-relevant tables (verified via
  `pg_tables.rowsecurity`).
- Critical indexes confirmed: `emails_user_id_gmail_id_key`,
  `browser_tasks_active_delivery_unique`, `oauth_state_nonces_expires_at_idx`,
  `oauth_state_nonces_user_id_consumed_at_idx`.
- Old global `emails_gmail_id_key` unique constraint confirmed dropped
  (replaced by the per-user `emails_user_id_gmail_id_key`).
- Zero orphaned `tailored_resumes -> master_resume` or
  `applications -> users` relationships.
- `supabase db advisors --type security` — no new findings tied to this
  migration set beyond `current_app_user_id` missing a pinned
  `search_path` (see Follow-ups below); remaining warnings
  (`auth_leaked_password_protection`, `auth_insufficient_mfa_options`) are
  project-level Auth settings, already tracked in
  `docs/MANUAL_EXTERNAL_ACTIONS.md`.

## Verification

- Typecheck: pass (after `npm install` — an earlier `--package-lock-only`
  install had left `unpdf`/`mammoth` type declarations missing).
- Migration-contract tests: 13 passed.
- Security tests: 23 passed.
- Unit tests: 169 passed.
- Production build: pass (58 routes).

## Follow-ups (not acted on — out of this task's scope)

- `public.current_app_user_id()` (added in
  `20260715150000_harden_legacy_rls.sql`) has a mutable `search_path`
  per the Supabase security advisor. Fixing requires a new forward
  migration (e.g. `SET search_path = public, pg_temp` on the function),
  which is explicitly out of scope here (final migration is
  `20260715220000`, no WS11 work authorized). Recommend a follow-up
  migration.
- `20260713120000_phase9_11_consultant_subscriptions.sql` retains a
  pre-existing (already-live-in-production before this session)
  `auth.uid()::text = user_id::text` policy comparison on
  `proactive_recommendations` (superseded later in the same migration
  run by `20260715113000_proactive_recommendations_v2.sql`),
  `consultant_messages`, `subscriptions`, and `usage_ledger` (superseded
  by `20260715150000_harden_legacy_rls.sql`). End state after all 20
  migrations is correctly scoped; only intermediate history carried the
  quirk, and it was not touched since it predates this task and was
  never a hard SQL error.
