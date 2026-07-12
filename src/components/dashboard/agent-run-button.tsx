"use client";

import { JobRunPanel } from "@/components/dashboard/job-run-panel";
import { useRouter } from "next/navigation";

export function AgentRunButton() {
  const router = useRouter();

  return (
    <JobRunPanel
      mode="agent"
      triggerLabel="Run AI Agent"
      onComplete={() => router.refresh()}
    />
  );
}
