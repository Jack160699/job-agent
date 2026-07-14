# External Blockers

| ID | Blocker | Impact | Workaround | Status |
|----|---------|--------|------------|--------|
| DNS-001 | `kairela.com` DNS not attached in Vercel | Canonical domain not live | Use `job-agent-mu-steel.vercel.app` fallback; code ready for kairela.com | Pending manual DNS |
| AUTH-001 | Supabase `exceed_egress_quota` on production project | Authenticated production E2E blocked | Upgrade plan or remove spend cap | Pending owner |
| SEC-001 | Historical shared E2E password in Git history | Account compromise risk if unchanged | Rotate password in Supabase; use env vars only | Pending owner |
| LAND-001 | Codex landing page in progress on `feat/kairela-product-v1` | Platform branch cannot integrate public homepage yet | Platform work in isolated worktree | In progress (Codex) |
