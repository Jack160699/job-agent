# Architecture

## System Overview

```mermaid
graph TB
    subgraph Client
        UI[Next.js Dashboard]
        Auth[Supabase Auth]
    end

    subgraph API
        Routes[API Routes]
        Cron[Cron Jobs]
        Pipeline[Job Pipeline]
    end

    subgraph AI
        Analyzer[Job Analyzer]
        Matcher[Match Scorer]
        Tailor[Resume Tailor]
        CoverLetter[Cover Letter Gen]
    end

    subgraph Data
        Prisma[Prisma ORM]
        Supabase[(Supabase PostgreSQL)]
        RLS[Row Level Security]
    end

    subgraph External
        OpenAI[OpenAI API]
        JobSources[Job Sources]
        Google[Google MCP]
        Browser[Browser MCP]
    end

    UI --> Auth
    UI --> Routes
    Routes --> Pipeline
    Cron --> Pipeline
    Pipeline --> Analyzer
    Pipeline --> Matcher
    Pipeline --> Tailor
    Pipeline --> CoverLetter
    Analyzer --> OpenAI
    Matcher --> OpenAI
    Tailor --> OpenAI
    CoverLetter --> OpenAI
    Pipeline --> JobSources
    Pipeline --> Browser
    Routes --> Prisma
    Prisma --> Supabase
    Supabase --> RLS
    Cron --> Google
```

## Application Workflow

```mermaid
sequenceDiagram
    participant Cron
    participant Pipeline
    participant AI
    participant DB
    participant User

    Cron->>Pipeline: Search Jobs
    Pipeline->>DB: Save discovered jobs
    Pipeline->>AI: Analyze job description
    AI->>DB: Store extracted skills
    Pipeline->>AI: Calculate match score
    AI->>DB: Store match analysis
    alt Score >= threshold
        Pipeline->>AI: Tailor resume (truthful)
        Pipeline->>AI: Generate cover letter
        Pipeline->>DB: Save documents
        Pipeline->>DB: Status: PENDING_REVIEW
        User->>Pipeline: Review & approve
        Pipeline->>DB: Status: SUBMITTED
    else Score < threshold
        Pipeline->>DB: Status: SKIPPED
    end
```

## Folder Structure

```
job-agent/
├── prisma/
│   └── schema.prisma          # Database schema
├── supabase/
│   └── migrations/            # SQL migrations with RLS
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── cron/          # Background job cron
│   │   │   ├── health/        # Health check
│   │   │   ├── jobs/          # Job search & processing
│   │   │   ├── resumes/       # Resume management
│   │   │   └── settings/      # User settings
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── login/             # Auth pages
│   │   └── signup/
│   ├── components/
│   │   ├── dashboard/         # Dashboard components
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── ai/                # AI modules
│   │   ├── data/              # Data access layer
│   │   ├── jobs/              # Job pipeline & adapters
│   │   ├── security/          # Encryption, rate limiting
│   │   └── supabase/          # Supabase clients
│   └── test/                  # Test setup
├── e2e/                       # Playwright E2E tests
├── docs/                      # Documentation
└── vercel.json                # Vercel deployment config
```

## Security Architecture

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row Level Security on all user tables
- **Secrets**: AES-256-GCM encryption for stored credentials
- **Rate Limiting**: IP-based rate limiting on API routes
- **Audit Logging**: All sensitive actions logged
- **Environment Validation**: Zod schema validation for env vars

## AI Truthfulness Policy

All AI modules enforce strict rules:
1. Only use information from the master resume
2. Never invent qualifications or experience
3. Honest gap analysis in match scoring
4. Fallback heuristics when OpenAI is unavailable
