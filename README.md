# Kairela

**Kairela** is an AI career and hiring operating system that helps job seekers discover relevant roles, score matches honestly, tailor resumes truthfully, and track every application.

**Production:** https://job-agent-mu-steel.vercel.app (interim) · **Brand domain:** https://kairela.com

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI**: OpenAI for job analysis, matching, resume tailoring, cover letters
- **Auth**: Supabase Auth (email + Google)
- **Deployment**: Vercel with cron jobs
- **Testing**: Vitest (unit), Playwright (E2E)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

## Environment Variables

See [.env.example](.env.example) for all required variables.

Key URLs:
- `NEXT_PUBLIC_APP_URL` — runtime app origin (OAuth callbacks, worker triggers)
- `NEXT_PUBLIC_CANONICAL_URL` — canonical public URL for SEO/metadata (`https://kairela.com` in production)

## Documentation

- [Kairela Product Roadmap](docs/KAIRELA_PRODUCT_ROADMAP.md)
- [Kairela Architecture](docs/KAIRELA_ARCHITECTURE.md)
- [Kairela Release Checklist](docs/KAIRELA_RELEASE_CHECKLIST.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [User Guide](docs/USER_GUIDE.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:migrate` | Run database migrations |

## License

Private — All rights reserved.
