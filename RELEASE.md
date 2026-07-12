# Kairela — Release Candidate

## Version

**0.4.0-rc.1** (Kairela Product V1)

## Production URL

| Environment | URL |
|-------------|-----|
| **Production (fallback)** | https://job-agent-mu-steel.vercel.app |
| **Target domain** | https://kairela.com (DNS pending) |

## Branch

`feat/kairela-product-v1`

## Rollback targets

| Label | Deployment ID |
|-------|---------------|
| Phase 1 Kairela | `dpl_Cwm8mhAhJ4yphuhZfpPUujAtcaJW` |
| Pre-Kairela RC v0.2 | `dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr` |

## Kairela V1 features

- Full Kairela rebrand and SEO
- Role-based conversational onboarding
- Preference-aware job discovery with excluded view
- Reliable background queue with admin ops
- Google + email authentication
- AI Career Consultant (floating chat)
- Proactive recommendations with snooze/dismiss
- Subscription entitlements foundation (billing behind flag)
- Legal pages (draft), admin ops console
- Production Playwright suite

## Documentation

- `CHANGELOG.md`
- `docs/FINAL_IMPLEMENTATION_REPORT.md`
- `docs/LAUNCH_RUNBOOK.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/SUPPORT_RUNBOOK.md`
- `docs/SECURITY_REVIEW.md`
- `docs/PRIVACY_DATA_MAP.md`

## Deploy

```bash
git push origin feat/kairela-product-v1
npx vercel --prod
curl https://job-agent-mu-steel.vercel.app/api/health
```

## Tag (after verification)

```bash
git tag -a v0.4.0-rc.1 -m "Kairela Product V1 release candidate"
git push origin v0.4.0-rc.1
```
