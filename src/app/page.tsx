import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Check,
  Search,
  FileText,
  Zap,
  Shield,
  Star,
  Building2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const logos = ["Stripe", "Notion", "Linear", "Figma", "Vercel", "Ramp"];

const features = [
  {
    icon: Search,
    title: "Smart discovery",
    desc: "Scans Greenhouse, Lever, Ashby, and Workday for roles that match your profile — not spam listings.",
  },
  {
    icon: FileText,
    title: "Honest tailoring",
    desc: "ATS-optimized resumes built only from your real experience. Never invents skills or credentials.",
  },
  {
    icon: Zap,
    title: "One-click apply",
    desc: "Fills applications, uploads documents, and pauses for your review before every submission.",
  },
  {
    icon: Shield,
    title: "Full transparency",
    desc: "Live progress, audit logs, and match scores you can trust. No black-box AI.",
  },
];

const steps = [
  { n: "1", title: "Upload resume", desc: "Your master resume becomes the single source of truth." },
  { n: "2", title: "Set preferences", desc: "Titles, locations, salary, and target companies." },
  { n: "3", title: "Run the agent", desc: "Watch live as jobs are found, scored, and prepared." },
  { n: "4", title: "Review & submit", desc: "Approve tailored materials before anything goes out." },
];

const quotes = [
  {
    text: "I went from spending 2 hours per application to reviewing 10 prepared applications in 30 minutes.",
    name: "Sarah K.",
    role: "Software Engineer",
  },
  {
    text: "The honest match scores saved me from applying to roles I'd never get. Quality over volume actually works.",
    name: "Marcus T.",
    role: "Product Manager",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-[var(--canvas)]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[var(--ink)]">Signal</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[var(--ink-secondary)] md:flex">
            <a href="#features" className="hover:text-[var(--ink)] transition-colors">Features</a>
            <a href="#how" className="hover:text-[var(--ink)] transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-[var(--ink)] transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-[var(--line)]">
          <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
                Job search, automated
              </p>
              <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-5xl md:leading-[1.1]">
                Apply to the right jobs.
                <br />
                <span className="text-[var(--ink-secondary)]">Skip the rest.</span>
              </h1>
              <p className="mt-4 max-w-lg text-balance text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
                Signal discovers relevant roles, scores matches honestly, tailors your resume truthfully,
                and tracks every application — so you can focus on interviews, not forms.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button size="lg" className="gap-2">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#preview">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Play className="h-4 w-4" />
                    See how it works
                  </Button>
                </a>
              </div>
              <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
                Free during beta · No credit card · Email verification required
              </p>
            </div>

            {/* Product preview */}
            <div id="preview" className="mt-12 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--line-strong)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--line-strong)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--line-strong)]" />
                <span className="ml-2 text-[10px] text-[var(--ink-tertiary)]">signal.app/dashboard</span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-[var(--line)]">
                {[
                  { l: "Jobs", v: "47" },
                  { l: "Matches", v: "12" },
                  { l: "Applied", v: "8" },
                  { l: "Interviews", v: "2" },
                ].map((s) => (
                  <div key={s.l} className="bg-[var(--surface)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--ink-tertiary)]">{s.l}</p>
                    <p className="text-xl font-semibold tabular-nums text-[var(--ink)]">{s.v}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--line)] px-4 py-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--ink)]">Searching Greenhouse…</span>
                  <span className="text-[var(--accent)]">68%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full w-[68%] rounded-full bg-[var(--accent)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logos */}
        <section className="border-b border-[var(--line)] py-8">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-widest text-[var(--ink-tertiary)]">
              Discover roles at top companies
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {logos.map((name) => (
                <span key={name} className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-tertiary)]">
                  <Building2 className="h-3.5 w-3.5" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-xl font-semibold text-[var(--ink)] md:text-2xl">
              Built for people who apply every day
            </h2>
            <p className="mt-2 max-w-lg text-sm text-[var(--ink-secondary)]">
              Every feature is designed for relevance and honesty — not vanity metrics.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-muted)]">
                    <f.icon className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[var(--ink)]">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-[var(--line)] bg-[var(--surface)] py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-xl font-semibold text-[var(--ink)]">How it works</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n}>
                  <span className="text-2xl font-semibold text-[var(--line-strong)]">{s.n}</span>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">{s.title}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-secondary)]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid gap-3 md:grid-cols-2">
              {quotes.map((q) => (
                <div
                  key={q.name}
                  className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-5"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">&ldquo;{q.text}&rdquo;</p>
                  <p className="mt-3 text-xs font-medium text-[var(--ink)]">{q.name}</p>
                  <p className="text-[10px] text-[var(--ink-tertiary)]">{q.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-[var(--line)] bg-[var(--surface-sunken)] py-16">
          <div className="mx-auto max-w-sm px-4 text-center">
            <h2 className="text-xl font-semibold text-[var(--ink)]">Simple pricing</h2>
            <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6">
              <p className="text-xs font-medium text-[var(--accent)]">Free during beta</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-[var(--ink)]">$0</p>
              <ul className="mt-6 space-y-2 text-left text-sm text-[var(--ink-secondary)]">
                {["Unlimited job searches", "AI match scoring", "Resume tailoring", "Application tracking"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                      {item}
                    </li>
                  )
                )}
              </ul>
              <Link href="/signup" className="mt-6 block">
                <Button className="w-full">Get started free</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="text-xl font-semibold text-[var(--ink)] md:text-2xl">
              Ready to land your next role?
            </h2>
            <Link href="/signup" className="mt-6 inline-block">
              <Button size="lg" className="gap-2">
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">Signal</span>
          </div>
          <p className="text-xs text-[var(--ink-tertiary)]">
            © {new Date().getFullYear()} Signal Job Agent
          </p>
          <div className="flex gap-4 text-xs text-[var(--ink-tertiary)]">
            <Link href="/login" className="hover:text-[var(--ink)]">Sign in</Link>
            <Link href="/signup" className="hover:text-[var(--ink)]">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
