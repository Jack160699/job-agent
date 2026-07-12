# Kairela Security Review

**Date:** 2026-07-13  
**Branch:** `feat/kairela-product-v1`

## Authentication

- Supabase Auth for email/password and Google OAuth
- Email verification required before dashboard (OAuth exempt)
- Password strength validation on signup
- Resend cooldown on verification emails

## Authorization

- RLS enabled on user-scoped tables including new consultant/subscription tables
- Admin routes gated by `KAIRELA_ADMIN_EMAILS` env allow-list
- Employer/recruiter/agency modes behind feature flags (default off)

## Secrets

- No client secrets in repository
- `CRON_SECRET`, `DATABASE_URL`, API keys via environment only
- Google Workspace OAuth uses separate incremental scope flow

## Data safety

- AI consultant instructed not to fabricate qualifications
- Applications require user review policy by default
- Candidate profiles private by default

## Outstanding

- Legal pages marked draft for legal review
- `kairela.com` DNS attachment pending
- Stripe billing not live (`FEATURE_BILLING=false`)
