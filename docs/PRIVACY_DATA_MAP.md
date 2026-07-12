# Kairela Privacy Data Map

| Data | Purpose | Storage | Retention |
|------|---------|---------|-----------|
| Email, name | Account | Supabase Auth, `users` | Until account deletion |
| Resume content | Matching, tailoring | `master_resumes` | User-controlled |
| Job preferences | Discovery filtering | `settings`, `preference_history` | User-controlled |
| Jobs, applications | Pipeline | `jobs`, `applications` | User-controlled |
| Consultant messages | AI career help | `consultant_messages` | User-scoped, RLS |
| Proactive recommendations | Nudges | `proactive_recommendations` | Dismiss/snooze |
| Usage ledger | Entitlements | `usage_ledger` | Operational |
| Audit logs | Transparency | `logs` | Operational |
| Google tokens | Optional integrations | `encrypted_secrets` | Encrypted at rest |

## Third parties

- Supabase (auth, database)
- Vercel (hosting)
- OpenAI (AI features)
- Google (optional Workspace)

## User rights

- Export: resumes, applications via dashboard
- Delete: account deletion via support (process documented at launch)
