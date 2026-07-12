import Link from "next/link";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Terms of Service — ${BRAND.name}`,
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] px-6 py-4">
        <Link href="/">
          <KairelaLogo />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm">
        <h1>Terms of Service</h1>
        <p className="text-[var(--ink-secondary)]">
          <strong>Draft for legal review.</strong> Last updated: July 13, 2026.
        </p>
        <h2>Service</h2>
        <p>
          {BRAND.name} provides AI-assisted job search, application preparation, and career
          tools. You are responsible for reviewing all materials before submission.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Do not misuse automation, misrepresent qualifications, or use the service for
          unlawful scraping or spam outreach.
        </p>
        <h2>AI disclosure</h2>
        <p>
          AI-generated suggestions are assistive only. Match scores and market insights are
          estimates, not guarantees.
        </p>
        <h2>Contact</h2>
        <p>
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
        </p>
        <p>
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/cookies">Cookie Policy</Link>
        </p>
      </main>
    </div>
  );
}
