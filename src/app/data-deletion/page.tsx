import Link from "next/link";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Data Deletion — ${BRAND.name}`,
  description: `How to request account data deletion or export from ${BRAND.name}.`,
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] px-6 py-4">
        <KairelaLogo href="/" />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Your data rights</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Data deletion and export</h1>
        <p className="mt-5 text-[var(--ink-secondary)]">You can ask Kairela to delete or export personal data associated with your account.</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[var(--ink-secondary)]">
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Before requesting deletion</h2><p className="mt-2">Disconnect optional Google integrations in account settings if you no longer want Kairela to access them. Deleting your Kairela account does not delete information held independently by a job site or email provider.</p></section>
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">Make a request</h2><p className="mt-2">Email <a className="text-[var(--accent)] underline" href={`mailto:${BRAND.supportEmail}?subject=Kairela%20data%20request`}>{BRAND.supportEmail}</a> from the address associated with your account. State whether you want deletion, an export, or both. We may need to verify account ownership before acting.</p></section>
          <section><h2 className="text-lg font-semibold text-[var(--ink)]">What happens next</h2><p className="mt-2">We will confirm the request and explain any information that must be retained for legal, security, fraud-prevention, or dispute-resolution purposes. This page is operational guidance and remains subject to the Privacy Policy.</p></section>
        </div>
        <p className="mt-12 text-sm"><Link className="text-[var(--accent)] underline" href="/privacy">Read the Privacy Policy</Link> · <Link className="text-[var(--accent)] underline" href="/">Return home</Link></p>
      </main>
    </div>
  );
}
