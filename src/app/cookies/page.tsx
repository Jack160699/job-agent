import Link from "next/link";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Cookie Policy — ${BRAND.name}`,
};

export default function CookiesPage() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] px-6 py-4">
        <Link href="/">
          <KairelaLogo />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert prose-sm">
        <h1>Cookie Policy</h1>
        <p className="text-[var(--ink-secondary)]">
          <strong>Draft for legal review.</strong> Last updated: July 13, 2026.
        </p>
        <h2>Essential cookies</h2>
        <p>
          Session and authentication cookies are required to keep you signed in and secure
          your account.
        </p>
        <h2>Analytics</h2>
        <p>
          We may use privacy-respecting analytics to improve performance. No third-party
          advertising cookies are used by default.
        </p>
        <p>
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link>
        </p>
      </main>
    </div>
  );
}
