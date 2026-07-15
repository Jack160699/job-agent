# Kairela public homepage design specification

Date: 15 July 2026
Status: implementation specification

## Product promise

Kairela is an AI career and hiring operating system. It learns a candidate's goals, finds suitable roles, prepares truthful application materials, and supports the journey through interviews and career growth.

The first viewport must answer:

1. What is it? An AI career operating system.
2. What does it do? Discovers, matches, prepares, and guides.
3. Why is it different? It manages the connected workflow with user control and truthful materials.
4. What next? Start free or see the workflow.

## Current-page audit

The previous landing page had a reliable foundation: a warm neutral palette, restrained navigation, correct authentication links, and a clear emphasis on honest tailoring. Its limits were narrative depth and product specificity. It used a compact dashboard strip, a repeated card grid, US-centric employer examples, one beta price, and a short footer. It did not demonstrate the complete Indian job-search workflow or create enough space for Discover, Apply, Grow, trust, market breadth, and AI reasoning.

## Design language

- Canvas: warm paper `#f4f1e8`
- Primary surface: soft cream `#fbfaf5`
- Ink: near-black olive `#16221d`
- Secondary ink: `#536159`
- Brand green: `#0b6f55`
- Light brand wash: `#dcece3`
- Marigold: `#e3a33b`
- Clay: `#c96f4b`
- Line: translucent ink, approximately 12%
- Radius: 12–32 px, proportional to component scale
- Shadow: broad, low-opacity green-black; never glass or neon glow

Typography uses the production-safe Geist family already bundled through `next/font`. The scale uses `clamp()` for continuous responsive behavior. Interface labels remain compact; story headings use large, balanced lines and a tight measure.

## Grid and spacing

- Content width: 1,240 px maximum with 20–32 px responsive gutters.
- Desktop hero: 5/7 asymmetric columns.
- Pillars: 4/8 or 5/7 editorial splits with a sticky visual on large screens.
- Mobile: one column with product visuals placed immediately after explanatory copy.
- Vertical chapter spacing: 96–168 px desktop; 72–104 px mobile.
- Minimum interactive target: 44 × 44 px.

## Section inventory

1. Sticky navigation and accessible mobile sheet.
2. Promise-led hero with workflow word sequence and original career workspace.
3. India-market employer text rail with no-affiliation disclosure.
4. Discover pillar: conversational preferences and explainable matches.
5. Apply pillar: public-link intake, extraction, truthful tailoring, ATS checks, review gate.
6. Grow pillar: consultant, recruiter reply, interview preparation, salary context, and weekly report.
7. Nine-step “See Kairela think” interactive demonstration with explicit illustrative-data label and replay.
8. Indian career breadth across technology, business/operations, and engineering/professional roles.
9. Editorial capability collection with asymmetric visual crops.
10. Trust and control chapter with legal/data links.
11. Clearly labeled illustrative scenarios without ratings or invented endorsements.
12. Free, Pro, and Premium pricing preview; paid checkout remains unavailable when billing is disabled.
13. Final CTA.
14. Full product/legal/support footer.

## Motion inventory

- Hero word sequence: CSS opacity/translate cycle, 9.6 s total; freezes to a readable word with reduced motion.
- Entry reveals: one small IntersectionObserver controller adds an `is-visible` state; 480–700 ms transform/opacity transitions.
- Product surfaces: 120–220 ms hover/focus feedback with small transform changes.
- Pillar stage: sticky at desktop widths; becomes normal document flow on mobile.
- Thinking demo: nine short state advances, a restrained progress bar, and crossfaded result rows; user can replay at any time.
- Optional scroll-linked rule: CSS view timeline where supported; absence does not affect comprehension.
- Reduced motion: no smooth scrolling, no word cycling, no reveal offset, no automatic demo progression.

## Original product fixtures

All landing data lives in `src/lib/data/landing-demo.ts` and is explicitly synthetic. Core fixture:

- Candidate: Aditi Sharma
- Target role: Business Analyst
- Preference: Pune / Remote
- Expected salary: ₹10–14 LPA
- Illustrative match: 89%
- Statuses: Resume ready, Application prepared, Interview reminder

No private customer data is used. Employer names are text-only illustrative examples and the page explicitly states that no affiliation or availability is implied.

## Responsive behavior

- Desktop navigation collapses below 900 px.
- Hero product UI moves from an asymmetric desktop workspace to stacked, horizontally safe mobile cards.
- Pillar sticky behavior is disabled below 960 px.
- Tables become compact card-like rows; no page-level horizontal scrolling is permitted.
- Pricing moves from three columns to a single readable stack.
- The final CTA keeps both actions visible and full-width on small devices.

## Accessibility

- One `h1`; section headings follow a consistent `h2` structure.
- Landmark navigation, main content, and footer are explicit.
- Skip link appears on keyboard focus.
- Visible focus rings use brand green with adequate separation.
- Menu uses `aria-expanded`, `aria-controls`, Escape handling, and labeled controls.
- Demo progress and state updates use clear text and avoid implying real application activity.
- Color is never the only status signal.
- Motion respects `prefers-reduced-motion`.

## Performance architecture

- The page remains a Server Component and ships a static first frame.
- Client code is isolated to the mobile menu, reveal observer, and dynamically loaded thinking demo.
- Product visuals use HTML and CSS rather than heavy media, video, canvas, or WebGL.
- No third-party marketing scripts or external image requests are introduced.
- Layout dimensions are explicit to avoid cumulative shift.
- Below-the-fold interactivity is code-split.

## Conversion model

The primary action is Start free and always routes to `/signup`. Log in routes to `/login`. Paid pricing actions remain non-transactional when billing is disabled. Copy avoids guarantees, unlimited claims, fake urgency, fabricated reviews, and false employer relationships.
