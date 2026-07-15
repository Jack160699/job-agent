import Link from "next/link";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `AI Disclosure — ${BRAND.name}`,
  description: `How AI assists candidates and hiring teams inside ${BRAND.name}.`,
};

export default function AiDisclosurePage() {
  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] px-6 py-4">
        <KairelaLogo href="/" />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Product transparency</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">AI Disclosure</h1>
        <p className="mt-5 text-[var(--ink-secondary)]">
          Kairela uses AI to assist with job discovery, match explanations, application preparation,
          career guidance, and hiring workflows. AI output can be incomplete or wrong and should be reviewed.
        </p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[var(--ink-secondary)]">
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Candidate materials</h2><p className="mt-2">Suggestions should be grounded in information a user provides. Kairela is not intended to invent experience, credentials, skills, projects, or outcomes.</p></section>
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Scores and insights</h2><p className="mt-2">Match scores, salary context, and career recommendations are estimates. They do not guarantee selection, interviews, offers, compensation, or employment.</p></section>
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Human control</h2><p className="mt-2">Users should review AI-assisted materials and choose an application submission policy. Employer and recruiter users remain responsible for hiring decisions and appropriate evaluation.</p></section>
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Questions</h2><p className="mt-2">Contact <a className="text-[var(--accent)] underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> with a question about AI-assisted features.</p></section>
        </div>
        <p className="mt-12 text-sm"><Link className="text-[var(--accent)] underline" href="/privacy">Privacy Policy</Link> · <Link className="text-[var(--accent)] underline" href="/terms">Terms of Service</Link></p>
      </main>
    </div>
  );
}
