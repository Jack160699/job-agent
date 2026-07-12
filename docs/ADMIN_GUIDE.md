# Admin Guide

## Initial Setup

### 1. Supabase Project

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration: `supabase/migrations/20260712000000_initial_schema.sql`
3. Copy project URL and keys to `.env.local`

### 2. Environment Configuration

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server only)
- `DATABASE_URL` — PostgreSQL connection string (with pgbouncer)
- `DIRECT_URL` — Direct PostgreSQL connection (for migrations)
- `OPENAI_API_KEY` — OpenAI API key
- `ENCRYPTION_KEY` — 32+ character hex key for secret encryption
- `CRON_SECRET` — Random secret for cron endpoint auth

### 3. Database Migration

```bash
npm run db:generate
npm run db:push
```

Or apply Supabase migration via SQL editor.

### 4. Vercel Deployment

1. Connect GitHub repository to Vercel
2. Set all environment variables in Vercel dashboard
3. Deploy — cron jobs run every 6 hours automatically

### 5. Google Integrations (Optional)

Configure OAuth credentials for:
- Gmail (recruiter inbox sync)
- Google Sheets (application tracker export)
- Google Calendar (interview sync)
- Google Drive (document storage)

## Monitoring

### Health Check
```
GET /api/health
```

### Cron Jobs
```
GET /api/cron
Authorization: Bearer <CRON_SECRET>
```

### Audit Logs
View in Dashboard → Logs or query `logs` table directly.

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key only in server environment
- [ ] ENCRYPTION_KEY is unique and secure
- [ ] CRON_SECRET is set and not exposed
- [ ] Rate limiting configured appropriately
- [ ] Supabase Auth email confirmation enabled

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails on Prisma | Run `npm run db:generate` |
| Auth redirect loop | Check Supabase URL config |
| AI features not working | Verify OPENAI_API_KEY |
| Cron not running | Check CRON_SECRET and Vercel cron config |
| RLS blocking queries | Ensure user has supabase_id set |
