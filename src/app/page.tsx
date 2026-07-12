import Link from "next/link";
import {
  Bot,
  Target,
  FileText,
  Shield,
  Zap,
  ArrowRight,
  Check,
  Sparkles,
  BarChart3,
  Mail,
  Play,
  ChevronDown,
  Star,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Target,
    title: "Smart Job Matching",
    description:
      "AI analyzes every job description and scores matches against your real profile — with honest gap analysis, never inflated scores.",
  },
  {
    icon: FileText,
    title: "Truthful Resume Tailoring",
    description:
      "ATS-optimized resumes built only from your actual qualifications. The agent never invents experience or skills.",
  },
  {
    icon: Zap,
    title: "Automated Applications",
    description:
      "Fills forms on Greenhouse, Lever, and Ashby. Uploads documents and pauses for your review before every submission.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "Encrypted secrets, row-level security, full audit logs, and rate limiting — built in from day one.",
  },
  {
    icon: BarChart3,
    title: "Application Analytics",
    description:
      "Track your funnel from discovery to offer. See match scores, conversion rates, and source breakdowns.",
  },
  {
    icon: Mail,
    title: "Recruiter Inbox",
    description:
      "Sync Gmail to centralize recruiter communications. Never miss an interview invite or follow-up.",
  },
];

const steps = [
  { step: "01", title: "Upload your resume", desc: "Import your master resume — the single source of truth for all tailoring." },
  { step: "02", title: "Configure filters", desc: "Set job titles, locations, salary range, and target companies." },
  { step: "03", title: "Run the AI agent", desc: "Watch live progress as jobs are discovered, scored, and applications prepared." },
  { step: "04", title: "Review & submit", desc: "Approve tailored resumes and cover letters before the agent submits." },
];

const testimonials = [
  {
    quote: "I went from 2 hours per application to reviewing 10 prepared applications in 30 minutes.",
    author: "Sarah K.",
    role: "Senior Engineer",
    company: "Previously at Meta",
  },
  {
    quote: "The honest match scores saved me from applying to jobs I'd never get. Quality over volume actually works.",
    author: "Marcus T.",
    role: "Product Manager",
    company: "Series B Startup",
  },
  {
    quote: "Finally an AI tool that doesn't hallucinate my experience. Every bullet point is verifiable.",
    author: "Priya R.",
    role: "Data Scientist",
    company: "Ex-Google",
  },
];

const faqs = [
  {
    q: "Does the AI invent experience on my resume?",
    a: "Never. Job Agent only uses information from your master resume. Tailoring reorders and emphasizes relevant skills — it does not fabricate qualifications.",
  },
  {
    q: "Which job boards are supported?",
    a: "Greenhouse, Lever, Ashby, Workday, LinkedIn, Indeed, and company career portals. More sources are added regularly.",
  },
  {
    q: "Can I review before applications are submitted?",
    a: "Yes. Review mode is enabled by default. The agent prepares everything and waits for your approval before submitting.",
  },
  {
    q: "Is my data secure?",
    a: "All secrets are encrypted at rest. Row-level security isolates your data. Full audit logs track every action.",
  },
];

const companies = ["OpenAI", "Stripe", "Linear", "Vercel", "Notion", "Figma"];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-zinc-800/50 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 shadow-lg shadow-violet-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Job Agent</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-zinc-200">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-zinc-200">How it works</a>
            <a href="#pricing" className="transition-colors hover:text-zinc-200">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-zinc-200">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="h-10 px-4">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-40">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
            <div className="absolute right-0 top-1/3 h-[300px] w-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
          </div>
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Job Search Agent
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-100 sm:text-6xl lg:text-7xl">
              Land your dream job with{" "}
              <span className="text-gradient">intelligent automation</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-zinc-400 sm:text-lg">
              Discover relevant jobs, get honest match scores, tailor your resume truthfully,
              and track every application — from one premium dashboard built for serious job seekers.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/signup">
                <Button size="lg" className="h-12 w-full gap-2 px-8 sm:w-auto">
                  Start Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline" className="h-12 w-full gap-2 sm:w-auto">
                  <Play className="h-4 w-4" />
                  Watch Demo
                </Button>
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">No credit card required · Email verification required</p>
          </div>

          {/* Product preview */}
          <div id="demo" className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
            <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 shadow-2xl shadow-violet-500/5">
              <div className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs text-zinc-500">Job Agent Dashboard</span>
              </div>
              <div className="grid gap-px bg-zinc-800/50 sm:grid-cols-4">
                {[
                  { label: "Active Jobs", value: "47", color: "text-violet-400" },
                  { label: "Strong Matches", value: "12", color: "text-emerald-400" },
                  { label: "Applications", value: "8", color: "text-blue-400" },
                  { label: "Interviews", value: "2", color: "text-pink-400" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-zinc-950 p-5">
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                    <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-950 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-300">Live Job Search</span>
                  <span className="text-xs text-violet-400">Searching Greenhouse…</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-violet-600 to-violet-400 progress-indeterminate" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            <ChevronDown className="h-5 w-5 animate-bounce text-zinc-600" />
          </div>
        </section>

        {/* Companies */}
        <section className="border-y border-zinc-800/50 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
              Discover jobs at top companies
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {companies.map((c) => (
                <span key={c} className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                  <Building2 className="h-4 w-4" />
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                Quality over volume
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
                Every feature maximizes relevance and honesty in your job search.
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/15 transition-colors group-hover:bg-violet-600/25">
                    <f.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-zinc-800/50 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                How the AI agent works
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
                Four steps from resume upload to submitted applications — with full transparency.
              </p>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div key={s.step} className="relative">
                  <span className="text-4xl font-bold text-violet-500/20">{s.step}</span>
                  <h3 className="mt-2 text-base font-semibold text-zinc-100">{s.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-zinc-800/50 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-100">
              Loved by job seekers
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.author} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6">
                  <div className="mb-4 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-300">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 border-t border-zinc-800/80 pt-4">
                    <p className="text-sm font-medium text-zinc-200">{t.author}</p>
                    <p className="text-xs text-zinc-500">{t.role} · {t.company}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-zinc-800/50 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Simple pricing</h2>
            <p className="mt-4 text-zinc-400">Start free. Upgrade when you&apos;re ready.</p>
            <div className="mt-10 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-8">
              <p className="text-sm font-medium text-violet-300">Free during beta</p>
              <p className="mt-2 text-5xl font-bold text-zinc-100">$0</p>
              <p className="mt-1 text-sm text-zinc-500">per month</p>
              <ul className="mt-8 space-y-3 text-left text-sm text-zinc-300">
                {["Unlimited job searches", "AI match scoring", "Resume tailoring", "Application tracking", "Gmail sync"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block">
                <Button size="lg" className="h-12 w-full">Get Started Free</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-zinc-800/50 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-100">
              Frequently asked questions
            </h2>
            <div className="mt-12 space-y-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-zinc-800/80 p-5">
                  <h3 className="font-medium text-zinc-100">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/50 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
              Ready to automate your job search?
            </h2>
            <p className="mt-4 text-zinc-400">
              Join job seekers who apply smarter, not harder.
            </p>
            <Link href="/signup" className="mt-8 inline-block">
              <Button size="lg" className="h-12 gap-2 px-8">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold">Job Agent</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Job Agent. Built with Next.js, Supabase, and OpenAI.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <Link href="/login" className="hover:text-zinc-300">Sign In</Link>
            <Link href="/signup" className="hover:text-zinc-300">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
