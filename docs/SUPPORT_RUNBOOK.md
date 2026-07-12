# Kairela Support Runbook

## Common issues

### Search stuck / low progress

1. Check `/api/health` queue stats
2. Admin: `/dashboard/admin/queue` → Recover stale jobs
3. User can retry search from Jobs page

### Email verification

- Resend has 60s cooldown
- OAuth users skip email verification gate
- Check Supabase auth logs for delivery failures

### Google login vs integrations

- **Login:** Supabase OAuth (openid, email, profile)
- **Integrations:** Settings → Google Workspace (incremental scopes)

### AI consultant limits

- FREE plan: 20 messages/day
- Check `/api/entitlements` for remaining usage

## Escalation

- Ops console: `/dashboard/admin` (requires `KAIRELA_ADMIN_EMAILS`)
- Health endpoint: `/api/health`
- Support: hello@kairela.com
