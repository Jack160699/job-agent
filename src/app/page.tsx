import Link from "next/link";
import { Bot, Target, FileText, Shield, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Target,
    title: "Smart Job Matching",
    description:
      "AI analyzes job descriptions and scores matches against your profile with honest gap analysis.",
  },
  {
    icon: FileText,
    title: "Truthful Resume Tailoring",
    description:
      "ATS-optimized resumes using only your real qualifications. Never invents experience.",
  },
  {
    icon: Zap,
    title: "Automated Applications",
    description:
      "Fills application forms, uploads documents, and pauses for your review before submission.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "Encrypted secrets, row-level security, audit logs, and rate limiting built in.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">Job Agent</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-zinc-950 to-zinc-950" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
              <Zap className="h-4 w-4" />
              AI-Powered Job Search Agent
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-zinc-100 sm:text-6xl">
              Land your dream job with{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                intelligent automation
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
              Discover relevant jobs, get honest match scores, tailor your resume
              truthfully, and track every application — all from one premium dashboard.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  Start Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-800/50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold text-zinc-100">
              Quality over volume
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
              Every feature is designed to maximize relevance and honesty in your job search.
            </p>
            <div className="mt-16 grid gap-8 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 transition-colors hover:border-zinc-700"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-600/20">
                    <feature.icon className="h-6 w-6 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/50 px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-sm text-zinc-500">
          Job Agent — Built with Next.js, Supabase, and OpenAI
        </div>
      </footer>
    </div>
  );
}
