# Search Quality and Relevance

## Ranking inputs

Kairela evaluates each role against explicit user preferences:

- desired titles and required/preferred skills;
- location, work mode, relocation, salary, experience, and visa needs;
- target and excluded companies;
- configurable match threshold;
- posting freshness;
- prior user feedback on exact role and company patterns.

Hard preference rejections are never overridden by positive feedback. Feedback adjustments are bounded and explained in the match reasons or concerns.

## Freshness

- 0–7 days: strongest freshness signal;
- 8–30 days: moderate freshness signal;
- 31–90 days: neutral;
- over 90 days: reduced score with an explicit stale-posting concern;
- unknown date: neutral score with an uncertainty disclosure.

## ATS extraction

- Greenhouse: public Boards API
- Lever: public Postings API
- Ashby: public Job Board API
- Workday: public CXS search and posting endpoints

Detail extractors return `null` when authoritative source data is unavailable. They do not return placeholder titles, companies, or descriptions.

Workday discovery accepts either a tenant slug or a full configured career-site URL. A full URL is recommended because Workday site names and data-center hosts vary.

## Feedback

Users can mark results useful or not useful and select a reason. Feedback is scoped to the authenticated user and job, protected by ownership checks and RLS, and applied to future searches.

Supported reasons include wrong role, location, seniority, salary, work mode, not interested, misleading posting, and other.

## Verification

Unit tests cover:

- preference-specific acceptance and rejection;
- freshness ranking and missing-date uncertainty;
- bounded positive and negative feedback adjustments;
- Lever, Ashby, and Workday extraction;
- source failure returning no fabricated result.
