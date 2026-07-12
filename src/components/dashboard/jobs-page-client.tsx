"use client";

import { JobSearchWorkflow } from "@/components/dashboard/job-search-workflow";

export function JobsPageClient({
  preferencesComplete,
  lastSearchAt,
  lastResultCount,
}: {
  preferencesComplete: boolean;
  lastSearchAt: string | null;
  lastResultCount: number;
}) {
  return (
    <JobSearchWorkflow
      preferencesComplete={preferencesComplete}
      lastSearchAt={lastSearchAt}
      lastResultCount={lastResultCount}
    />
  );
}
