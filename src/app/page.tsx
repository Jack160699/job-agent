import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  FileCheck2,
  FileText,
  Gauge,
  Link2,
  LockKeyhole,
  MailCheck,
  MapPin,
  MessageCircleMore,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  WalletCards,
} from "lucide-react";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { MobileNavigation } from "@/components/landing/mobile-navigation";
import { RevealController } from "@/components/landing/reveal-controller";
import { ThinkingDemoLoader } from "@/components/landing/thinking-demo-loader";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  applicationChecks,
  discoverMatches,
  discoverPreferences,
  growthSignals,
  heroCandidate,
  illustrativeEmployers,
  illustrativeScenarios,
  pricingTiers,
  roleGroups,
} from "@/lib/data/landing-demo";

const capabilities = [
  { icon: Link2, title: "Paste any public job link", copy: "Turn a role page into a structured, reviewable opportunity." },
  { icon: SlidersHorizontal, title: "Preference-aware search", copy: "Use role, location, salary, work mode, and exclusions together." },
  { icon: FileText, title: "Resume intelligence", copy: "Surface truthful changes grounded in the experience you provided." },
  { icon: FileCheck2, title: "Cover letter generation", copy: "Prepare focused drafts that connect verified work to the role." },
  { icon: Gauge, title: "Match explanations", copy: "See the signals behind a score, including strengths and realistic gaps." },
  { icon: UserCheck, title: "Review-led preparation", copy: "Keep a human checkpoint before an application moves forward." },
  { icon: MailCheck, title: "Recruiter tracking", copy: "Optionally connect Gmail and keep replies attached to the right role." },
  { icon: CalendarCheck2, title: "Interview calendar", copy: "Bring interview details, preparation, and reminders into one view." },
  { icon: WalletCards, title: "Salary guidance", copy: "Compare expectations with illustrative location and role context." },
  { icon: MessageCircleMore, title: "Kairela AI consultant", copy: "Ask questions with the context of your goals and active search." },
  { icon: TrendingUp, title: "Proactive recommendations", copy: "Receive useful next actions without a noisy stream of alerts." },
  { icon: BriefcaseBusiness, title: "Employer tools", copy: "Organise candidate context, shortlists, replies, and interviews." },
] as const;

const trustPrinciples = [
  {
    icon: BadgeCheck,
    title: "Truth over embellishment",
    copy: "Kairela does not invent work experience, projects, skills, credentials, or outcomes.",
  },
  {
    icon: UserCheck,
    title: "You review the work",
    copy: "Suggested changes and prepared materials remain visible before any submission decision.",
  },
  {
    icon: SlidersHorizontal,
    title: "Your submission policy",
    copy: "Applications follow the review and submission policy you choose for your account.",
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    copy: "Candidate profiles begin private. You control discoverability and optional Google connections.",
  },
  {
    icon: ShieldCheck,
    title: "Protected access",
    copy: "Protected data uses authorization checks and row-level access policies. Integrations can be disconnected.",
  },
  {
    icon: CircleUserRound,
    title: "Your data rights",
    copy: "You can request an export or deletion and review how AI assists the product.",
  },
] as const;

export default function HomePage() {
  const billingReady = FEATURE_FLAGS.billing;

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">Skip to main content</a>
      <RevealController />

      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <KairelaLogo href="/" size="lg" subtitle={null} className="landing-brand" />

          <nav className="landing-desktop-nav" aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#job-seekers">For job seekers</a>
            <a href="#employers">For employers</a>
            <a href="#career-partner">AI career partner</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="landing-header-actions">
            <Link className="landing-login-link" href="/login">Log in</Link>
            <Link className="landing-button landing-button-primary landing-header-cta" href="/signup">
              Start free
              <ArrowUpRight aria-hidden />
            </Link>
            <MobileNavigation />
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero" aria-labelledby="hero-title" data-testid="landing-hero">
          <div className="landing-hero-mesh" aria-hidden />
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy" data-reveal>
              <p className="landing-eyebrow"><span />AI career and hiring operating system</p>
              <h1 id="hero-title">Your career,<br />managed by <em>Kairela.</em></h1>
              <p className="landing-hero-description">
                Kairela learns what you want, finds relevant opportunities, tailors every application truthfully,
                and guides you from search to interview.
              </p>

              <div className="landing-hero-actions">
                <Link className="landing-button landing-button-primary landing-button-large" href="/signup">
                  Start free
                  <ArrowRight aria-hidden />
                </Link>
                <a className="landing-button landing-button-secondary landing-button-large" href="#how-it-works">
                  See how Kairela works
                  <ArrowDown aria-hidden />
                </a>
              </div>

              <div className="landing-hero-assurance">
                <ShieldCheck aria-hidden />
                <span>Free to begin · Private by default · You review before submission</span>
              </div>

              <div className="landing-verb-line" role="group" aria-label="Kairela helps you discover, match, apply, and grow">
                <span>Built to help you</span>
                <span className="landing-verb-window" aria-hidden>
                  <b>Discover</b>
                  <b>Match</b>
                  <b>Apply</b>
                  <b>Grow</b>
                </span>
              </div>
            </div>

            <div className="landing-hero-product" data-reveal>
              <div className="hero-product-halo" aria-hidden />
              <div className="hero-workspace" role="img" aria-label="Illustrative Kairela workspace for Aditi Sharma">
                <div className="hero-workspace-topbar">
                  <div className="hero-workspace-dots" aria-hidden><span /><span /><span /></div>
                  <span className="hero-workspace-address">kairela / career workspace</span>
                  <span className="hero-workspace-demo-label">Synthetic demo</span>
                </div>

                <div className="hero-workspace-grid">
                  <aside className="hero-profile-panel">
                    <div className="hero-profile-heading">
                      <span>{heroCandidate.initials}</span>
                      <div><strong>{heroCandidate.name}</strong><small>Career profile</small></div>
                    </div>
                    <dl>
                      <div><dt>Target role</dt><dd>{heroCandidate.targetRole}</dd></div>
                      <div><dt>Location</dt><dd><MapPin aria-hidden />{heroCandidate.location}</dd></div>
                      <div><dt>Expected</dt><dd>{heroCandidate.salary}</dd></div>
                    </dl>
                    <div className="hero-profile-completeness">
                      <span>Profile confidence</span><strong>92%</strong>
                      <i><b /></i>
                    </div>
                  </aside>

                  <div className="hero-match-panel">
                    <div className="hero-panel-heading">
                      <div><span>Best new match</span><strong>{heroCandidate.company}</strong></div>
                      <span className="hero-live-pill"><i />Analysed</span>
                    </div>
                    <div className="hero-role-line">
                      <div><BriefcaseBusiness aria-hidden /><span><strong>{heroCandidate.targetRole}</strong><small>Pune · Hybrid · Full-time</small></span></div>
                      <div className="hero-match-score"><strong>{heroCandidate.match}%</strong><span>match</span></div>
                    </div>
                    <div className="hero-signal-grid">
                      <span><CheckCircle2 aria-hidden />Strong SQL overlap</span>
                      <span><CheckCircle2 aria-hidden />Salary aligned</span>
                      <span><Sparkles aria-hidden />Explainable fit</span>
                    </div>
                    <div className="hero-next-action">
                      <span>Next best action</span>
                      <strong>Review the tailored application</strong>
                      <ChevronRight aria-hidden />
                    </div>
                  </div>

                  <aside className="hero-activity-panel">
                    <span className="hero-activity-label">Today</span>
                    {heroCandidate.status.map((status, index) => (
                      <div key={status} className="hero-activity-row">
                        <span>{index === 0 ? <FileCheck2 aria-hidden /> : index === 1 ? <BadgeCheck aria-hidden /> : <CalendarCheck2 aria-hidden />}</span>
                        <div><strong>{status}</strong><small>{index === 2 ? "Tomorrow · 10:30" : "Completed with review"}</small></div>
                      </div>
                    ))}
                  </aside>
                </div>
              </div>

              <div className="hero-floating-note hero-floating-note-left">
                <Sparkles aria-hidden /><span>Kairela found <strong>7 relevant roles</strong> this morning.</span>
              </div>
              <div className="hero-floating-note hero-floating-note-right">
                <MessageCircleMore aria-hidden /><span>“Want to prepare for the analyst case round?”</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-employer-rail" aria-label="Illustrative employer examples">
          <div className="landing-container">
            <div className="landing-rail-heading">
              <p>Built for careers across India</p>
              <span>Illustrative employer examples · No affiliation or job availability implied</span>
            </div>
            <div className="landing-employer-marquee">
              {illustrativeEmployers.map((name) => <span key={name}>{name}</span>)}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-story-intro" data-reveal>
          <div className="landing-container landing-story-intro-grid">
            <p className="landing-section-number">01 — 03</p>
            <h2>One connected journey,<br />from uncertainty to momentum.</h2>
            <p>Most tools give you another list. Kairela keeps the context—from what you want to what you should do next.</p>
          </div>
        </section>

        <section id="job-seekers" className="landing-pillar landing-pillar-discover" data-testid="discover-section">
          <div className="landing-container landing-pillar-grid">
            <div className="landing-pillar-copy" data-reveal>
              <span className="landing-pillar-index">01 / Discover</span>
              <h2>Find roles that<br /><em>actually fit.</em></h2>
              <p>
                Tell Kairela what matters in plain language. It searches with your role, city, salary, work mode,
                and exclusions in mind—then explains every result.
              </p>
              <ul>
                <li><Check aria-hidden />Pune, Bengaluru, Hyderabad, Mumbai, Delhi NCR, or remote</li>
                <li><Check aria-hidden />Relevant and excluded roles stay visibly separated</li>
                <li><Check aria-hidden />Match reasons are readable, not a mystery score</li>
              </ul>
            </div>

            <div className="landing-pillar-visual discover-visual" data-reveal>
              <div className="product-frame product-frame-green">
                <div className="product-frame-bar">
                  <span><Search aria-hidden />Discover</span><small>Search in progress · 18 sources</small>
                </div>
                <div className="discover-onboarding">
                  <div className="discover-avatar">K</div>
                  <div className="discover-conversation">
                    <p>What would make your next role worth moving for?</p>
                    <div className="discover-preferences">
                      {discoverPreferences.map((preference) => <span key={preference}>{preference}</span>)}
                    </div>
                  </div>
                </div>
                <div className="discover-progress"><span><b /></span><small>Searching company career pages and public job sources…</small></div>
                <div className="discover-results">
                  {discoverMatches.map((match) => (
                    <article key={`${match.company}-${match.role}`} className={match.status === "Excluded" ? "is-excluded" : ""}>
                      <div className="discover-result-logo">{match.company.slice(0, 1)}</div>
                      <div className="discover-result-copy"><strong>{match.role}</strong><span>{match.company} · {match.location}</span><small>{match.reason}</small></div>
                      <div className="discover-result-score"><strong>{match.match}%</strong><span>{match.status}</span></div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-pillar landing-pillar-apply" data-testid="apply-section">
          <div className="landing-container landing-pillar-grid landing-pillar-grid-reverse">
            <div className="landing-pillar-copy" data-reveal>
              <span className="landing-pillar-index">02 / Apply</span>
              <h2>Every application,<br /><em>prepared around you.</em></h2>
              <p>
                Paste a public job link. Kairela extracts the role, compares it with your profile, suggests truthful
                resume improvements, and prepares a review pack before anything can move forward.
              </p>
              <ul>
                <li><Check aria-hidden />No invented skills, projects, titles, or results</li>
                <li><Check aria-hidden />ATS structure and role language reviewed together</li>
                <li><Check aria-hidden />A clear candidate checkpoint before submission</li>
              </ul>
            </div>

            <div className="landing-pillar-visual apply-visual" data-reveal>
              <div className="product-frame product-frame-cream">
                <div className="product-frame-bar">
                  <span><Link2 aria-hidden />Application studio</span><small>Review required</small>
                </div>
                <div className="apply-link-field"><Link2 aria-hidden /><span>jobs.example.in/northstar/business-analyst</span><b>Extracted</b></div>
                <div className="apply-document-grid">
                  <div className="apply-document">
                    <div className="apply-document-header"><span>AS</span><div><strong>Aditi Sharma</strong><small>Business Analyst</small></div></div>
                    <div className="apply-document-lines"><i /><i /><i /><i /><i /><i /></div>
                    <div className="apply-change-note"><Sparkles aria-hidden /><span>3 truthful relevance edits suggested</span></div>
                  </div>
                  <div className="apply-checklist">
                    <span className="apply-checklist-label">Preparation checklist</span>
                    {applicationChecks.map((check, index) => (
                      <div key={check.label}>
                        <span className={index === applicationChecks.length - 1 ? "is-review" : ""}>{index === applicationChecks.length - 1 ? <UserCheck aria-hidden /> : <Check aria-hidden />}</span>
                        <p><strong>{check.label}</strong><small>{check.state}</small></p>
                      </div>
                    ))}
                    <button type="button" disabled>Review application pack</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="career-partner" className="landing-pillar landing-pillar-grow" data-testid="grow-section">
          <div className="landing-container landing-pillar-grid">
            <div className="landing-pillar-copy" data-reveal>
              <span className="landing-pillar-index">03 / Grow</span>
              <h2>A career partner<br /><em>that keeps helping.</em></h2>
              <p>
                Kairela connects the moments after you apply: recruiter replies, preparation, salary context,
                useful reminders, and a weekly view of what is moving.
              </p>
              <ul>
                <li><Check aria-hidden />Proactive advice tied to your active goals</li>
                <li><Check aria-hidden />Role-specific interview preparation</li>
                <li><Check aria-hidden />Weekly progress without vanity metrics</li>
              </ul>
            </div>

            <div className="landing-pillar-visual grow-visual" data-reveal>
              <div className="product-frame product-frame-ink">
                <div className="product-frame-bar">
                  <span><TrendingUp aria-hidden />Career partner</span><small>Weekly view</small>
                </div>
                <div className="grow-dashboard">
                  <div className="grow-consultant-card">
                    <div className="grow-consultant-heading"><span>K</span><div><strong>Good morning, Aditi.</strong><small>Your search has two useful next moves.</small></div></div>
                    <p>Northstar asked for interview availability. I’ve prepared a short company brief and six analyst questions.</p>
                    <div className="grow-consultant-actions"><span>Open interview plan</span><span>Review recruiter reply</span></div>
                  </div>
                  <div className="grow-signal-list">
                    {growthSignals.map((signal, index) => (
                      <div key={signal.label}>
                        <span>{index === 0 ? <MailCheck aria-hidden /> : index === 1 ? <CalendarCheck2 aria-hidden /> : <BarChart3 aria-hidden />}</span>
                        <p><strong>{signal.label}</strong><small>{signal.detail}</small></p>
                        <time>{signal.time}</time>
                      </div>
                    ))}
                  </div>
                  <div className="grow-weekly-report">
                    <div><span>Weekly career report</span><strong>Momentum is focused—not just busy.</strong></div>
                    <div className="grow-bars" role="img" aria-label="Illustrative weekly progress"><i /><i /><i /><i /><i /><i /><i /></div>
                  </div>
                </div>
              </div>
              <div className="grow-floating-consultant" aria-hidden><MessageCircleMore /><span>Ask Kairela</span></div>
            </div>
          </div>
        </section>

        <section className="landing-thinking-section" aria-labelledby="thinking-title">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-centered" data-reveal>
              <p className="landing-eyebrow"><span />Transparent by design</p>
              <h2 id="thinking-title">See Kairela think through<br />your next move.</h2>
              <p>Follow one clearly illustrative role from public link to candidate-controlled review and follow-up.</p>
            </div>
            <div data-reveal><ThinkingDemoLoader /></div>
          </div>
        </section>

        <section id="employers" className="landing-market-section" aria-labelledby="market-title">
          <div className="landing-container">
            <div className="landing-market-heading" data-reveal>
              <p className="landing-section-number">Across the Indian job market</p>
              <h2 id="market-title">One career system.<br /><em>More than one kind of career.</em></h2>
              <p>Kairela is being designed for technology and non-technology paths—from first applications to experienced transitions.</p>
            </div>
            <div className="landing-role-groups" data-reveal>
              {roleGroups.map((group, groupIndex) => (
                <article key={group.eyebrow}>
                  <div className="landing-role-group-heading"><span>0{groupIndex + 1}</span><h3>{group.eyebrow}</h3></div>
                  <ul>{group.roles.map((role) => <li key={role}>{role}<ArrowUpRight aria-hidden /></li>)}</ul>
                </article>
              ))}
            </div>
            <div className="landing-employer-note" data-reveal>
              <span>Employer and recruiter tools</span>
              <p>Candidate shortlists, role context, replies, and interviews can live in the same operating system—without pretending every employer works the same way.</p>
              <a href="#capabilities">Explore the capability map <ArrowRight aria-hidden /></a>
            </div>
          </div>
        </section>

        <section id="capabilities" className="landing-capabilities-section" aria-labelledby="capabilities-title">
          <div className="landing-container">
            <div className="landing-section-heading" data-reveal>
              <p className="landing-eyebrow"><span />Connected capabilities</p>
              <h2 id="capabilities-title">Less tab switching.<br />More forward motion.</h2>
            </div>
            <div className="landing-capability-editorial" data-reveal>
              <article className="capability-feature capability-feature-large">
                <div className="capability-feature-copy"><span>Application intelligence</span><h3>One profile. Every role seen in context.</h3><p>Bring discovery, match reasons, truthful tailoring, and review policy into a single decision.</p></div>
                <div className="capability-resume-crop" aria-hidden>
                  <div className="capability-resume-page"><span>AS</span><i /><i /><i /><i /><i /><i /></div>
                  <div className="capability-match-card"><strong>89%</strong><span>Business Analyst</span><small>3 aligned strengths · 1 learnable gap</small></div>
                </div>
              </article>
              <article className="capability-feature capability-feature-medium">
                <div className="capability-feature-copy"><span>Connected follow-up</span><h3>Replies and interviews stay attached to the opportunity.</h3></div>
                <div className="capability-inbox-crop">
                  <MailCheck aria-hidden /><div><strong>Interview availability</strong><span>Northstar Retail · 12 minutes ago</span></div><b>Linked</b>
                </div>
              </article>
              <article className="capability-feature capability-feature-small">
                <div className="capability-feature-copy"><span>Career guidance</span><h3>Advice with your goals in view.</h3></div>
                <div className="capability-advice-crop"><Sparkles aria-hidden /><p>Focus this week on analyst case practice and two high-fit applications.</p></div>
              </article>
            </div>
            <div className="landing-capability-list" data-reveal>
              {capabilities.map((capability) => (
                <article key={capability.title}>
                  <capability.icon aria-hidden />
                  <div><h3>{capability.title}</h3><p>{capability.copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-trust-section" aria-labelledby="trust-title">
          <div className="landing-container">
            <div className="landing-trust-hero" data-reveal>
              <div>
                <p className="landing-eyebrow landing-eyebrow-light"><span />Trust is a product decision</p>
                <h2 id="trust-title">Your career story<br />should remain <em>yours.</em></h2>
              </div>
              <p>Kairela is designed to help without quietly taking control. Clear review points, honest materials, optional connections, and visible data choices are part of the workflow.</p>
            </div>
            <div className="landing-trust-grid" data-reveal>
              {trustPrinciples.map((principle) => (
                <article key={principle.title}><principle.icon aria-hidden /><h3>{principle.title}</h3><p>{principle.copy}</p></article>
              ))}
            </div>
            <div className="landing-trust-links" data-reveal>
              <Link href="/privacy">Privacy <ArrowUpRight aria-hidden /></Link>
              <Link href="/terms">Terms <ArrowUpRight aria-hidden /></Link>
              <Link href="/cookies">Cookies <ArrowUpRight aria-hidden /></Link>
              <Link href="/ai-disclosure">AI disclosure <ArrowUpRight aria-hidden /></Link>
              <Link href="/data-deletion">Data deletion <ArrowUpRight aria-hidden /></Link>
            </div>
          </div>
        </section>

        <section className="landing-scenarios-section" aria-labelledby="scenarios-title">
          <div className="landing-container">
            <div className="landing-section-heading" data-reveal>
              <p className="landing-eyebrow"><span />Illustrative scenarios—not reviews</p>
              <h2 id="scenarios-title">Different starting points.<br />One calmer next step.</h2>
              <p>These examples show intended use cases. They are not customer quotes, ratings, or outcome claims.</p>
            </div>
            <div className="landing-scenario-list" data-reveal>
              {illustrativeScenarios.map((scenario, index) => (
                <article key={scenario.title}>
                  <div className="landing-scenario-person"><span>{scenario.initials}</span><div><small>Scenario 0{index + 1}</small><h3>{scenario.title}</h3></div></div>
                  <div><small>Situation</small><p>{scenario.situation}</p></div>
                  <div><small>How Kairela helps</small><p>{scenario.outcome}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="landing-pricing-section" aria-labelledby="pricing-title" data-testid="pricing-section">
          <div className="landing-container">
            <div className="landing-pricing-heading" data-reveal>
              <div><p className="landing-eyebrow"><span />Pricing preview</p><h2 id="pricing-title">Start with clarity.<br />Upgrade when it helps.</h2></div>
              <p>Paid checkout is {billingReady ? "available" : "not yet available"}. Limits will remain visible and specific before billing begins.</p>
            </div>
            <div className="landing-pricing-grid" data-reveal>
              {pricingTiers.map((tier, index) => (
                <article key={tier.name} className={index === 1 ? "is-featured" : ""}>
                  <div className="landing-pricing-card-heading">
                    <span>{tier.name}</span>
                    {index === 0 ? <small>Available now</small> : <small>{billingReady ? "Preview" : "Checkout off"}</small>}
                  </div>
                  <div className="landing-price"><strong>{tier.price}</strong><span>{tier.cadence}</span></div>
                  <p>{tier.description}</p>
                  <ul>{tier.features.map((feature) => <li key={feature}><Check aria-hidden />{feature}</li>)}</ul>
                  {index === 0 ? (
                    <Link className="landing-button landing-button-primary" href="/signup">Start free <ArrowRight aria-hidden /></Link>
                  ) : (
                    <button type="button" className="landing-button landing-button-secondary" disabled={!billingReady}>
                      {billingReady ? "View plan" : "Available after beta"}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <p className="landing-pricing-footnote">Plan prices and allowances are a preview and may change before paid launch. No “unlimited” usage is promised.</p>
          </div>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <div className="landing-final-cta-orbit" aria-hidden><span /><span /><span /></div>
          <div className="landing-container landing-final-cta-inner" data-reveal>
            <p className="landing-eyebrow landing-eyebrow-light"><span />A better way forward</p>
            <h2 id="final-cta-title">Your next opportunity deserves<br />more than another job board.</h2>
            <p>Let Kairela understand your goals, organise your search, and help you move forward.</p>
            <div>
              <Link className="landing-button landing-button-light landing-button-large" href="/signup">Start with Kairela <ArrowUpRight aria-hidden /></Link>
              <Link className="landing-button landing-button-dark-ghost landing-button-large" href="/login">Log in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <KairelaLogo href="/" size="lg" subtitle={null} />
              <p>An AI career and hiring operating system built with clarity, care, and human control.</p>
            </div>
            <div className="landing-footer-columns">
              <div><h2>Product</h2><a href="#how-it-works">How it works</a><a href="#job-seekers">Job seekers</a><a href="#employers">Employers</a><a href="#career-partner">AI career partner</a><a href="#pricing">Pricing</a></div>
              <div><h2>Trust</h2><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link><Link href="/ai-disclosure">AI disclosure</Link><Link href="/data-deletion">Data deletion</Link></div>
              <div><h2>Support</h2><a href="mailto:hello@kairela.com?subject=Kairela%20support">Support</a><a href="mailto:hello@kairela.com">Contact</a><Link href="/login">Log in</Link><Link href="/signup">Sign up</Link></div>
            </div>
          </div>
          <div className="landing-footer-bottom"><span>© {new Date().getFullYear()} Kairela</span><span>India-first. Ready for global careers.</span></div>
        </div>
      </footer>
    </div>
  );
}
