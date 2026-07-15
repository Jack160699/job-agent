# AI Agent Architecture

## Overview

Kairela's in-app career consultant combines:

1. **Context layer** (`src/lib/agent/context.ts`) — page-aware summaries from authorized DB fields
2. **Tool layer** (`src/lib/agent/tools.ts`) — read-only tools the model can invoke
3. **Service** (`src/lib/consultant/service.ts`) — orchestration, entitlements, persistence
4. **UI** (`src/components/consultant/consultant-fab.tsx`) — floating assistant on authenticated routes

## Tools (read-only)

| Tool | Purpose |
|------|---------|
| `get_current_context` | Page + account summary |
| `get_profile` | User profile and onboarding |
| `get_preferences` | Job search preferences |
| `get_search_status` | Latest background search job |
| `list_saved_jobs` | Active jobs with match scores |
| `list_applications` | Recent application statuses |

Write tools (search, save, submit) require explicit user confirmation via UI — not auto-executed.

## Security

- Tools query only the authenticated `userId`
- External job text treated as untrusted in system prompt
- Entitlement gate: `ai_consultant` usage ledger
- Rate limit: `RATE_LIMIT_PRESETS.aiChat`

## Streaming

`POST /api/consultant/chat/stream` exposes Vercel AI SDK streaming for future client integration. The FAB currently uses the non-streaming tool-enabled endpoint for reliability.

## Suggested prompts

Page-specific suggestions generated in `pageSuggestions()` and returned on GET/POST.
