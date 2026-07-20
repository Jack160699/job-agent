# Release security and warning disposition

Verified on 2026-07-20 with `npm audit --omit=dev`, ESLint, TypeScript, and the
production build.

## Production advisories

There are no critical or high-severity production advisories.

| Package | Severity | Runtime exposure | Available fix | Breaking risk | Mitigation and disposition |
| --- | --- | --- | --- | --- | --- |
| `ai` | Moderate | Server-side AI generation paths; the application does not render `jsondiffpatch` HTML and does not use the AI SDK's file-type whitelist as an upload security boundary | Upgrade `ai` from 4.x to 7.x | High: multiple major versions and API changes across every AI call | Retained for this release. Resume uploads are independently size/type/signature validated before AI use; generated text is rendered as React text, not `jsondiffpatch` HTML. A dedicated major-version migration is required. |
| `jsondiffpatch` (transitive through `ai`) | Moderate | No reachable formatter use in Kairela | Upgrade through `ai` 7.x | High: same major SDK migration | Retained. The vulnerable HTML formatter is not imported or called. |
| `@ai-sdk/openai` | Low | Server-side model provider | Upgrade 1.x to 4.x | High: provider and AI SDK compatibility changes | Retained with server-side rate limits, request timeouts, entitlement quotas, and bounded prompts. |
| `@ai-sdk/provider-utils` | Low | Transitive server-side request helpers | Upgrade through the AI SDK major migration | High | Retained with application-level quotas, input size limits, and timeouts. |
| `@ai-sdk/react` | Low | Transitive client helpers | Upgrade through `ai` 7.x | High | Retained; Kairela bounds chat frequency and response size, and does not expose unrestricted generation. |
| `@ai-sdk/ui-utils` | Low | Transitive UI utilities | Upgrade through `ai` 7.x | High | Retained; the affected resource paths are bounded by application rate and entitlement controls. |

## Framework and lint warnings

- The deprecated Next.js `middleware.ts` convention was replaced by
  `proxy.ts`.
- ESLint completes without warnings.
- TypeScript completes without errors.
- A forced AI SDK major upgrade is intentionally excluded from this closure
  release because it is not a compatible security patch and would broaden the
  regression surface across generation, streaming, and provider code.
