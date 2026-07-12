# Job Agent

AI-powered job application assistant that discovers jobs, matches them against your profile, tailors resumes truthfully, and tracks every application.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI**: OpenAI GPT-4o-mini for job analysis, matching, resume tailoring, cover letters
- **Auth**: Supabase Auth
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

## Documentation

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
