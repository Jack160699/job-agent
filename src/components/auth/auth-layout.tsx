import { KairelaLogo } from "@/components/brand/kairela-logo";
import { BRAND } from "@/lib/brand";

export function AuthLayout({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--canvas)]">
      <header className="flex h-14 items-center border-b border-[var(--line)] px-4">
        <KairelaLogo href="/" size="md" subtitle={null} />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-[var(--ink)]">{title}</h1>
            <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--line)]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-[var(--canvas)] px-3 text-[var(--ink-tertiary)]">or continue with email</span>
      </div>
    </div>
  );
}
