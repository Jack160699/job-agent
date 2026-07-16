# Resume-First Onboarding

Status: Implemented, preview-verified pending owner Preview-env DB config
Branch: `release/kairela-v1-rc`
Scope: JOB_SEEKER onboarding only. No LinkedIn login, no global redesign, no
employer/recruiter work, no production deploy.

## Previous flow

The job-seeker onboarding (`ConversationalOnboarding`) was a fixed nine-step
questionnaire: `welcome → basics → goals → location → skills → compensation →
companies → resume → apply_prefs → complete`. Resume upload was buried as
step 8 of 9, after the user had already manually typed their name, target
role, experience, skills, compensation, and company preferences — all
information a resume typically contains. The resume step itself only
extracted a hardcoded skill keyword list, an optional years-of-experience
regex, and a single job-title guess; nothing else was structured.

## New flow

```
Sign up / sign in
  → Persona choice (unchanged "welcome" step)
  → Resume upload ("resume" step) — or "Continue without a resume"
  → Review extracted profile ("review" step, skipped if resume was skipped)
  → Preferences — only what the resume/skip path didn't answer ("preferences" step)
  → Completion ("complete" step) → /dashboard/jobs
```

`JOB_SEEKER_STEPS` (`src/lib/onboarding/steps.ts`) is now
`["welcome", "resume", "review", "preferences", "complete"]`. The hiring
persona flow (`HIRING_STEPS`) is untouched.

### Routing rules (`src/lib/onboarding/service.ts`, `src/lib/onboarding/gate.ts`)

1. Incomplete onboarding + no master resume → resume upload screen (default
   `currentStep` position, unchanged gate behavior).
2. Incomplete onboarding + a master resume already exists (uploaded in a
   prior session, or via Settings/Resume History) → `resolveEntryStep()`
   detects this on the next `GET /api/onboarding` and advances
   `currentStep` straight to `review`, loading the resume's stored profile.
3. Onboarding complete → `ensureOnboardingComplete()` (unchanged) never
   redirects the user back into onboarding.
4. Explicit skip ("Continue without a resume") → `action: "skip_resume"`
   marks `resumeSkipped` and jumps straight to `preferences` with the
   reduced/baseline field set visible.
5. Existing users are never forced to repeat onboarding — `isOnboardingComplete`
   and the `ensureOnboardingComplete` gate are unchanged.

No new redirect logic was scattered across pages; all of the above lives in
the existing onboarding gate/service/API route.

## Parser architecture

`src/lib/resumes/parser.ts` (trusted upload path, unchanged validation) still
does file-type sniffing (magic bytes + extension), size/empty checks, and
section splitting. It now feeds into a new extraction layer:

- `src/lib/resumes/career-profile.ts` — deterministic, regex/heuristic based
  extraction of the full `ParsedCareerProfile` structured below. No network
  calls, always runs, and is the ultimate fallback.
- `src/lib/resumes/career-profile-ai.ts` — optional AI-assisted enhancement
  using the repository's existing OpenAI abstraction
  (`src/lib/ai/openai-client.ts`, same pattern as `job-analyzer.ts`). Only
  fills fields the deterministic pass left empty; never overwrites a
  deterministic value; returns the profile unchanged if `OPENAI_API_KEY` is
  unset or the call fails for any reason.

`POST /api/resumes/master` (the single, existing, trusted resume endpoint —
reused, not duplicated) now always computes this profile after parsing and
stores it. `GET /api/resumes/master` returns it alongside the resume record.

## Structured profile schema

```ts
ParsedCareerProfile {
  fullName, email, phone, currentLocation, professionalSummary,
  currentRole, jobTitles, experienceYears, skills,
  experience[], education[], projects[], certifications[], languages[],
  linkedinUrl, githubUrl, portfolioUrl,
  meta: { extractionMethod: "deterministic" | "hybrid", generatedAt }
}
```

Every field is wrapped as `ExtractedField<T>`:

```ts
{ value: T, confidence: number, source: string | null, directlyFound: boolean, needsReview: boolean }
```

## Grounding rules (no fabrication)

- Missing information stays `null`/`[]` — never inferred.
- Job titles, employers, degrees, dates, and skills are only populated when
  literally present in the resume text.
- Experience years: an explicit "`N years experience`" statement is trusted
  directly; otherwise a value is only computed from date ranges when at
  least two distinct years are found, and is always flagged
  `needsReview: true` — it is never presented as a confirmed fact.
- The AI-assisted path (`career-profile-ai.ts`) grounds every scalar/array
  value it returns against the raw resume text (case-insensitive substring
  match) and drops anything not literally present before merging it in —
  see `groundAiProfile()` and its fabrication-prevention tests. The
  professional summary is the one exception (it is a paraphrase by nature)
  and is always marked `needsReview: true` so the user confirms it.
- Skills and job titles are deduplicated case-insensitively.
- The original resume text and section structure are preserved unchanged in
  `MasterResume.rawText` / `MasterResume.content.sections`.

## Merge/conflict policy (`src/lib/onboarding/merge-policy.ts`)

Applied when confirming the review screen against the user's existing
(already-confirmed) profile:

- Empty existing value → filled automatically from the resume.
- Existing value equal to the resume value → unchanged.
- Existing value **not yet confirmed** (a brand-new user, or a value that
  was never explicitly reviewed) → filled from the resume even if a stale
  default was present.
- Existing value **confirmed** (onboarding was completed before, or the
  review/preferences steps were already completed once) and it disagrees
  with the resume → surfaced as an explicit conflict; the user picks which
  value to keep. Nothing is silently overwritten.

## Persistence strategy

No new tables and no database migration. Existing fields are reused:

- `MasterResume.content` (JSON) — now includes a `profile` key holding the
  full `ParsedCareerProfile` (with provenance) alongside the existing
  `sections`/`source` structure.
- `MasterResume.experience` / `.education` / `.projects` (existing, unused
  JSON columns) — now populated with the plain extracted arrays.
- `User.fullName`, `.currentLocation`, `.linkedinUrl`, `.githubUrl`,
  `.portfolioUrl` — updated via the existing `saveOnboardingProgress` path
  once the user confirms the review.
- `UserSettings.currentRole`, `.jobTitles`, `.experienceYears`,
  `.requiredSkills`, `.locations`, `.workModes`, `.industries`, etc. —
  same, via the existing upsert path.
- `OnboardingState.draftData` only stores the confirmed scalar merge
  outcome and a `resumeSkipped` flag — the full profile is not duplicated
  there; it lives once, in `MasterResume.content.profile`.
- `MasterResumeVersion` — unchanged; a version snapshot is still written on
  every re-upload, preserving resume history exactly as before.

## Skip path

"Continue without a resume" (`action: "skip_resume"`) sets `resumeSkipped`
and routes straight to `preferences`, which then asks the baseline fields
(name, location, current role, experience, skills) that would otherwise
have come from the resume, in addition to the job-search preferences every
job seeker answers. Resume upload remains available at any time afterward
from Resume History or Settings (pre-existing, unmodified surface) and from
onboarding itself via "Upload a different resume" on the review screen.

## Security / privacy controls

- Reuses the existing trusted parsing path: file-type sniffing, size limits,
  empty-file rejection, and rate limiting (`RATE_LIMIT_PRESETS.resume`) —
  none weakened.
- AI extraction never blocks the deterministic fallback and fails silently
  on missing credentials or errors.
- Analytics events (`src/lib/analytics/events.ts`) are allow-listed and
  never carry resume text, names, emails, or phone numbers — payloads are
  sanitized server-side before being written to the existing `AuditLog`
  table (`action: "analytics:<event>"`).
- `requireReview` defaults to `true` and `autoSubmitEnabled` defaults to
  `false` for every new profile; auto-submit requires the user to
  explicitly opt in on the preferences screen, with plain-language copy
  explaining what it does.
- Cross-user isolation is unchanged: every route resolves the authenticated
  user via `resolveApiUser()` and scopes all reads/writes to that user's
  own records.

## Remaining limitations

- Experience/education/project entries in the review screen are read-only
  (editable at the chip level for skills/job titles, and via full edit
  later from Resume History) rather than individually editable inline —
  scoped down given the size of this task; flagged for a follow-up pass.
- Scanned/unreadable PDFs still surface the existing safe explanation; no
  OCR was added, per instructions.
- Legacy `.doc` is explicitly rejected with guidance to export as PDF/DOCX;
  no `.doc` parser was added.
- Preview-environment Supabase/DB credentials are not configured on Vercel
  (only `Production` has them — see "Owner actions" in the implementation
  doc), so the preview deployment for this change cannot be fully
  DB-verified until that's addressed; this was already a tracked owner
  action before this task.
