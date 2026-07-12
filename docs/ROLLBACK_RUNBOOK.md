# Kairela Rollback Runbook

## Quick rollback (Vercel)

```bash
# Phase 1 rollback target
npx vercel promote dpl_Cwm8mhAhJ4yphuhZfpPUujAtcaJW --yes

# Pre-Kairela RC
npx vercel promote dpl_AUKdL3Y8tmpNPAg9mdPxNgoN4JZr --yes
```

## Verify after rollback

```bash
curl https://job-agent-mu-steel.vercel.app/api/health
```

## Database

- Do **not** run destructive schema rollbacks without assessment
- New tables (consultant, subscriptions) are additive; older code ignores them
- Code rollback first; migrate forward if schema drift occurs

## Git rollback

```bash
git checkout master
git revert <commit-range>  # prefer revert over reset on shared branches
```
