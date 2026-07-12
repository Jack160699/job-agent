import Link from "next/link";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: `How ${BRAND.name} collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] px-6 py-4">
        <Link href="/">
          <KairelaLogo />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm">
        <h1>Privacy Policy</h1>
        <p className="text-[var(--ink-secondary)]">
          <strong>Draft for legal review.</strong> Last updated: July 13, 2026.
        </p>
        <h2>What we collect</h2>
        <p>
          Account information (email, name), resume and application materials you upload,
          job search preferences, and usage data necessary to operate the service.
        </p>
        <h2>How we use data</h2>
        <p>
          To match jobs to your preferences, generate tailored materials from your real
          experience, run background searches, and provide AI-assisted career guidance.
        </p>
        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell your personal data.</li>
          <li>We do not invent qualifications or work history.</li>
          <li>We do not submit applications without your configured policy and review.</li>
          <li>Candidate profiles are private by default.</li>
        </ul>
        <h2>Third parties</h2>
        <p>
          We use Supabase (auth/database), Vercel (hosting), and OpenAI (AI features).
          Google Workspace integrations are optional and use separate OAuth scopes.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy requests:{" "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        </p>
        <p>
          <Link href="/terms">Terms of Service</Link> · <Link href="/cookies">Cookie Policy</Link>
        </p>
      </main>
    </div>
  );
}
