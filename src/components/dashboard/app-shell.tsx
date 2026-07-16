"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Target,
  FileText,
  Mail,
  ClipboardList,
  Inbox,
  Calendar,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  X,
} from "lucide-react";
import { KairelaLogo } from "@/components/brand/kairela-logo";
import { KairelaMark } from "@/components/brand/kairela-mark";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/applications", label: "Apply", icon: ClipboardList },
  { href: "/dashboard/resumes", label: "Resume", icon: FileText },
];

const moreNav = [
  { href: "/dashboard/matches", label: "Matches", icon: Target },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: Mail },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/calendar", label: "Interviews", icon: Calendar },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
];

const desktopNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/matches", label: "Matches", icon: Target },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardList },
  { href: "/dashboard/resumes", label: "Resumes", icon: FileText },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: Mail },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  // Warm the router cache for the most-visited dashboard routes once,
  // regardless of how the user reached the dashboard (email/password,
  // Google, or LinkedIn) — internal navigation to these should already be
  // cached and feel instant.
  useEffect(() => {
    for (const href of [
      "/dashboard",
      "/dashboard/jobs",
      "/dashboard/resumes",
      "/dashboard/applications",
      "/dashboard/settings",
    ]) {
      router.prefetch(href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  }, [router]);

  const pageTitle =
    desktopNav.find((n) => isActive(pathname, n.href, n.href === "/dashboard"))?.label ??
    "Dashboard";

  return (
    <div className="min-h-dvh bg-[var(--canvas)]">
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-dvh w-[var(--sidebar-width)] flex-col border-r border-[var(--line)] bg-[var(--surface)] md:flex"
        aria-label="Main navigation"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--line)] px-4">
          <KairelaLogo href="/dashboard" size="md" subtitle="Career OS" />
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {desktopNav.map((item) => {
            const active = isActive(pathname, item.href, item.href === "/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium transition-colors duration-[120ms]",
                  active
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--line)] p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b border-[var(--line)] bg-[var(--surface)] px-4 md:hidden"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 shrink-0">
            <KairelaMark />
          </div>
          <h1 className="text-sm font-semibold text-[var(--ink)]">{pageTitle}</h1>
        </div>
      </header>

      {/* Mobile bottom nav — solid, no glass */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--line)] bg-[var(--surface)] md:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
        aria-label="Tab navigation"
      >
        <div className="flex h-[var(--bottom-nav-height)] items-stretch">
          {mainNav.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "tap-active flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-[var(--accent)]" : "text-[var(--ink-tertiary)]"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "tap-active flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              moreOpen || moreNav.some((n) => isActive(pathname, n.href))
                ? "text-[var(--accent)]"
                : "text-[var(--ink-tertiary)]"
            )}
            aria-label="More navigation"
            aria-expanded={moreOpen}
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} />
            More
          </button>
        </div>
      </nav>

      {/* More sheet — sits ABOVE bottom nav, never overlaps */}
      {moreOpen && (
        <div className="fixed inset-0 z-[45] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            style={{ bottom: "calc(var(--bottom-nav-height) + var(--safe-bottom))" }}
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
          />
          <div
            className="absolute left-0 right-0 flex max-h-[70dvh] flex-col rounded-t-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-lg"
            style={{ bottom: "calc(var(--bottom-nav-height) + var(--safe-bottom))" }}
            role="dialog"
            aria-label="More options"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--ink)]">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-secondary)] hover:bg-[var(--surface-sunken)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {moreNav.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "tap-active flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                        : "text-[var(--ink-secondary)] hover:bg-[var(--surface-sunken)]"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-[var(--line)] p-2">
              <button
                type="button"
                onClick={handleLogout}
                className="tap-active flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-muted)]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="app-main mx-auto max-w-[var(--content-max)]">{children}</main>
    </div>
  );
}

export function DashboardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 hidden md:block">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--ink-tertiary)]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
