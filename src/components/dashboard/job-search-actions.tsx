"use client";

import { JobRunPanel } from "@/components/dashboard/job-run-panel";
import { useRouter } from "next/navigation";

export function JobSearchActions() {
  const router = useRouter();

  return (
    <JobRunPanel
      mode="search"
      triggerLabel="Run Job Search"
      onComplete={() => router.refresh()}
    />
  );
}
