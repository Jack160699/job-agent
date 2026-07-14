"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorCallout } from "@/components/ui/error-callout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobRunProgress {
  jobId: string | null;
  status: string;
  stage: string;
  stageLabel: string;
  progress: number;
  jobsFound: number;
  jobsNew: number;
  jobsRelevant: number;
  jobsExcluded: number;
  queuePosition: number | null;
  error: string | null;
  stalled: boolean;
  completedAt: string | null;
  claimedAt: string | null;
  logs?: Array<{ message: string }>;
}

interface JobSearchWorkflowProps {
  lastSearchAt?: string | null;
  lastResultCount?: number;
  preferencesComplete?: boolean;
}

export function JobSearchWorkflow({
  lastSearchAt,
  lastResultCount = 0,
  preferencesComplete = false,
}: JobSearchWorkflowProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<JobRunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [completedBanner, setCompletedBanner] = useState<{
    relevant: number;
    new: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/progress?type=SEARCH_JOBS");
      const data = await res.json();
      const p = data.progress as JobRunProgress | null;
      if (!p) return;
      setProgress(p);

      if (p.status === "completed" && !doneRef.current) {
        doneRef.current = true;
        stopPolling();
        setRunning(false);
        setCompletedBanner({ relevant: p.jobsRelevant, new: p.jobsNew });
        setExpanded(false);
        toast.success(`Search complete — ${p.jobsRelevant} relevant jobs found`);
        router.refresh();
      }
      if (p.status === "failed" && !doneRef.current) {
        doneRef.current = true;
        stopPolling();
        setRunning(false);
        setError(p.error || "Search failed");
      }
      if (p.status === "cancelled" && !doneRef.current) {
        doneRef.current = true;
        stopPolling();
        setRunning(false);
        setError("Search was cancelled. Start a new search when ready.");
      }
      if (p.stalled && running) {
        setError("Search is taking longer than expected. You can retry.");
      }
    } catch {
      // ignore transient poll errors
    }
  }, [running, router, stopPolling]);

  const startRun = async () => {
    if (!preferencesComplete) {
      router.push("/dashboard/onboarding");
      return;
    }

    setRunning(true);
    setError(null);
    setCompletedBanner(null);
    doneRef.current = false;

    try {
      const res = await fetch("/api/jobs/search?async=true", { method: "POST" });
      const data = await res.json();

      if (res.status === 422 && data.redirect) {
        setRunning(false);
        router.push(data.redirect);
        return;
      }
      if (!res.ok) throw new Error(data.error || data.message || "Failed to start");

      pollRef.current = setInterval(pollProgress, 1200);
      await pollProgress();
    } catch (err) {
      setRunning(false);
      const msg = err instanceof Error ? err.message : "Failed to start search";
      setError(msg);
      toast.error(msg);
    }
  };

  const cancelRun = async () => {
    try {
      const response = await fetch("/api/jobs/search", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Search cancellation failed");
      }
      doneRef.current = true;
      stopPolling();
      setRunning(false);
      setError(
        data.cancelled
          ? "Search cancelled. Results already saved remain available."
          : "No active search was found."
      );
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : "Search cancellation failed"
      );
    }
  };

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (!running && !completedBanner) {
      fetch("/api/jobs/progress?type=SEARCH_JOBS")
        .then((r) => r.json())
        .then((d) => {
          const p = d.progress as JobRunProgress | null;
          if (p && (p.status === "pending" || p.status === "running")) {
            setRunning(true);
            doneRef.current = false;
            pollRef.current = setInterval(pollProgress, 1200);
          }
        })
        .catch(() => {});
    }
  }, [pollProgress, running, completedBanner]);

  return (
    <div className="space-y-3">
      {/* Action row — integrated in content grid */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={startRun}
            disabled={running}
            className="h-11 min-h-[44px] gap-2"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {running ? "Searching…" : "Run Job Search"}
          </Button>
          <Button variant="outline" className="h-11 min-h-[44px] gap-2" asChild>
            <Link href={preferencesComplete ? "/dashboard/settings" : "/dashboard/onboarding"}>
              <Settings2 className="h-4 w-4" />
              Edit search preferences
            </Link>
          </Button>
        </div>
        {!running && !completedBanner && lastSearchAt && (
          <p className="text-xs text-[var(--ink-tertiary)]">
            Last search {lastSearchAt}
            {lastResultCount > 0 ? ` · ${lastResultCount} relevant jobs` : ""}
          </p>
        )}
      </div>

      {/* Completion banner */}
      {completedBanner && !running && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--success)]/25 bg-[var(--success-muted)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--success)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Search complete — {completedBanner.relevant} relevant jobs found
              {completedBanner.new > 0 ? ` (${completedBanner.new} new)` : ""}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setCompletedBanner(null);
              document.getElementById("job-results")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            View results
          </Button>
        </div>
      )}

      {/* Compact progress — desktop inline, mobile sticky strip */}
      {running && (
        <div
          className={cn(
            "rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)]",
            "md:static",
            "fixed inset-x-0 bottom-[calc(var(--bottom-nav-height,0px)+env(safe-area-inset-bottom))] z-40 mx-3 border-b-0 shadow-lg md:relative md:mx-0 md:shadow-none"
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent)]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-[var(--ink)]">
                  {progress?.stageLabel || "Starting search…"}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-[var(--ink-tertiary)]">
                  {progress?.progress ?? 5}%
                </span>
              </div>
              <Progress value={progress?.progress ?? 5} className="mt-2 h-1.5" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 text-[var(--ink-tertiary)]"
              onClick={() => void cancelRun()}
            >
              <Square className="h-3 w-3" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>

          {expanded && progress && (
            <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--ink-tertiary)]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <span>Relevant: {progress.jobsRelevant}</span>
                <span>New: {progress.jobsNew}</span>
                <span>Excluded: {progress.jobsExcluded}</span>
                {progress.queuePosition != null && progress.queuePosition > 0 && (
                  <span>Queue: #{progress.queuePosition}</span>
                )}
              </div>
              {progress.logs?.slice(0, 5).map((log, i) => (
                <p key={i} className="mt-1 truncate font-mono text-[10px]">
                  {log.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <ErrorCallout
          title={error.startsWith("Search cancelled") ? "Search stopped" : "Search stalled"}
          what={error}
          fix={
            error.startsWith("Search cancelled")
              ? "Start a new search whenever you are ready."
              : "Check your preferences and try again. The queue may be recovering."
          }
          onRetry={startRun}
          retrying={running}
        />
      )}
    </div>
  );
}
