"use client";

import Link from "next/link";
import { JobSearchWorkflow } from "@/components/dashboard/job-search-workflow";
import { cn } from "@/lib/utils";

export function JobsPageClient({
  preferencesComplete,
  lastSearchAt,
  lastResultCount,
  activeView = "matches",
}: {
  preferencesComplete: boolean;
  lastSearchAt: string | null;
  lastResultCount: number;
  activeView?: "matches" | "excluded";
}) {
  return (
    <div className="space-y-4">
      <JobSearchWorkflow
        preferencesComplete={preferencesComplete}
        lastSearchAt={lastSearchAt}
        lastResultCount={lastResultCount}
      />
      <div className="flex gap-2 border-b border-[var(--line)] pb-2">
        <Link
          href="/dashboard/jobs"
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium",
            activeView === "matches"
              ? "bg-[var(--accent-muted)] text-[var(--accent)]"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          )}
        >
          Matches
        </Link>
        <Link
          href="/dashboard/jobs?view=excluded"
          className={cn(
            "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium",
            activeView === "excluded"
              ? "bg-[var(--accent-muted)] text-[var(--accent)]"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          )}
        >
          Excluded by preferences
        </Link>
      </div>
    </div>
  );
}
