"use client";

import Link from "next/link";
import { JobSearchWorkflow } from "@/components/dashboard/job-search-workflow";
import { cn } from "@/lib/utils";
import type { JobResultsView } from "@/lib/data/dashboard";

export function JobsPageClient({
  preferencesComplete,
  lastSearchAt,
  lastResultCount,
  activeView = "recommended",
}: {
  preferencesComplete: boolean;
  lastSearchAt: string | null;
  lastResultCount: number;
  activeView?: JobResultsView;
}) {
  const views: Array<{ value: JobResultsView; label: string }> = [
    { value: "recommended", label: "Recommended" },
    { value: "possible", label: "Possible" },
    { value: "saved", label: "Saved" },
    { value: "imported", label: "Imported" },
    { value: "excluded", label: "Excluded" },
    { value: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-4">
      <JobSearchWorkflow
        preferencesComplete={preferencesComplete}
        lastSearchAt={lastSearchAt}
        lastResultCount={lastResultCount}
      />
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-2">
        {views.map((view) => (
          <Link
            key={view.value}
            href={
              view.value === "recommended"
                ? "/dashboard/jobs"
                : `/dashboard/jobs?view=${view.value}`
            }
            className={cn(
              "shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium",
              activeView === view.value
                ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            )}
          >
            {view.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
