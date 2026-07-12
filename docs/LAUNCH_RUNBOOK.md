# Kairela Launch Runbook

**Production URL:** https://job-agent-mu-steel.vercel.app  
**Target domain:** https://kairela.com (DNS pending)

## Pre-launch

1. Verify `/api/health` returns `ok`
2. Run `npm test` and `npm run test:e2e:rc`
3. Confirm migrations applied on Supabase
4. Set `KAIRELA_ADMIN_EMAILS` for ops console access
5. Verify Google OAuth redirect URLs include production + kairela.com

## Deploy

```bash
git push origin feat/kairela-product-v1
npx vercel --prod
```

## Post-deploy smoke

- Landing page loads with Kairela branding
- Login / signup / Google OAuth
- Onboarding flow for new user
- Job search completes with progress stages
- Consultant FAB responds (if OpenAI configured)

## Domain cutover (when DNS ready)

1. Attach `kairela.com` and `www.kairela.com` in Vercel
2. Update `NEXT_PUBLIC_APP_URL` / canonical env vars
3. Update Supabase redirect allow-list
4. Update Google OAuth origins
5. Verify SSL and www redirect
