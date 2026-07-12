"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  ClipboardList,
  FileText,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/applications", label: "Apps", icon: ClipboardList },
  { href: "/dashboard/resumes", label: "Resume", icon: FileText },
  { href: "/dashboard/settings", label: "More", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800/80 glass md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Main navigation"
    >
      <div className="flex h-[var(--bottom-nav-height)] items-stretch justify-around px-1">
        {primaryNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[var(--tap-target)] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-violet-400"
                  : "text-zinc-500 active:text-zinc-300"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]")}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
