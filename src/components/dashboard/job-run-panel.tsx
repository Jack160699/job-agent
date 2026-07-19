"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Bot,
  Building2,
  Clock,
  ListOrdered,
  FileText,
  CheckCircle2,
  Loader2,
  XCircle,
  SlidersHorizontal,
  Settings,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorCallout } from "@/components/ui/error-callout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JobRunProgress {
  jobId: string | null;
  type: string;
  status:
    | "pending"
    | "running"
    | "pause_requested"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  stage: string;
  stageLabel: string;
  progress: number;
  jobsFound: number;
  jobsNew: number;
  jobsRelevant: number;
  jobsExcluded: number;
  failedSources: Array<{ source: string; error?: string }>;
  summary: string | null;
  currentCompany: string | null;
  currentAts: string | null;
  queuePosition: number | null;
  estimatedSecondsRemaining: number | null;
  logs: Array<{ time: string; level: string; message: string }>;
  error: string | null;
  result: {
    sources?: Array<{
      source: string;
      requested?: boolean;
      success: boolean;
      fetched: number;
      relevant?: number;
      durationMs?: number;
      lastSuccessfulFetch?: string;
      error?: string;
    }>;
    searchStageCounts?: {
      strict: number;
      balanced: number;
      recovery: number;
    };
    searchSummary?: {
      primaryRoles?: string[];
      relatedRoles?: string[];
      locations?: string[];
      sources?: string[];
    };
    zeroResultDiagnosis?: {
      explanation: string[];
      suggestedActions: Array<
        | "retry_sources"
        | "include_remote"
        | "lower_match_threshold"
        | "reduce_salary_minimum"
        | "review_preferences"
        | "review_profile"
      >;
    } | null;
    filterImpact?: Record<string, number>;
  } | null;
}

interface JobRunPanelProps {
  mode: "search" | "agent";
  triggerLabel?: string;
  onComplete?: () => void;
  className?: string;
}

export function JobRunPanel({
  mode,
  triggerLabel,
  onComplete,
  className,
}: JobRunPanelProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<JobRunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [broadening, setBroadening] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const jobType = mode === "search" ? "SEARCH_JOBS" : "RUN_AGENT";
  const endpoint =
    mode === "search" ? "/api/jobs/search?async=true" : "/api/agent/run?async=true";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/progress?type=${jobType}`);
      const data = await res.json();
      if (!res.ok) return;

      const p = data.progress as JobRunProgress | null;
      if (!p) return;

      setProgress(p);

      if (p.status === "completed" && !completedRef.current) {
        completedRef.current = true;
        stopPolling();
        setRunning(false);
        if (mode === "search") {
          toast.success(
            `Search complete — ${p.jobsFound} jobs found (${p.jobsNew} new)`
          );
        } else {
          toast.success("AI agent run complete");
        }
        onComplete?.();
      }

      if (p.status === "failed" && !completedRef.current) {
        completedRef.current = true;
        stopPolling();
        setRunning(false);
        setError(p.error || "Job failed");
      }

      if (p.status === "paused") {
        stopPolling();
        setRunning(false);
      }
    } catch {
      // silent poll failure
    }
  }, [jobType, mode, onComplete, stopPolling]);

  const startRun = async () => {
    setRunning(true);
    setError(null);
    setProgress(null);
    completedRef.current = false;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start");
      }

      if (!data.queued && mode === "search" && data.total != null) {
        setRunning(false);
        setProgress({
          jobId: null,
          type: jobType,
          status: "completed",
          stage: "completed",
          stageLabel: "Complete",
          progress: 100,
          jobsFound: data.total,
          jobsNew: data.new ?? 0,
          jobsRelevant: data.relevant ?? data.total,
          jobsExcluded: data.excluded ?? 0,
          failedSources: (data.sources ?? [])
            .filter((source: { success?: boolean }) => !source.success)
            .map((source: { source: string; error?: string }) => source),
          summary: null,
          currentCompany: null,
          currentAts: null,
          queuePosition: null,
          estimatedSecondsRemaining: null,
          logs: [],
          error: null,
          result: {
            zeroResultDiagnosis: data.zeroResultDiagnosis ?? null,
            filterImpact: data.filterImpact ?? {},
            sources: data.sources ?? [],
          },
        });
        toast.success(`Found ${data.total} jobs (${data.new} new)`);
        onComplete?.();
        return;
      }

      pollRef.current = setInterval(pollProgress, 1500);
      await pollProgress();
    } catch (err) {
      setRunning(false);
      const msg = err instanceof Error ? err.message : "Failed to start";
      setError(msg);
      toast.error(msg);
    }
  };

  const cancelRun = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/jobs/search", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel search");
      stopPolling();
      setRunning(false);
      toast.success(data.message || "Search cancelled — results already saved remain available.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel search");
    } finally {
      setCancelling(false);
    }
  };

  const controlRun = async (action: "pause" | "resume") => {
    setControlling(true);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search control failed");
      toast.success(data.message);
      if (action === "resume" && data.resumed) {
        setRunning(true);
        completedRef.current = false;
        pollRef.current = setInterval(pollProgress, 1500);
        await pollProgress();
      } else if (action === "pause" && data.paused) {
        await pollProgress();
      }
    } catch (controlError) {
      toast.error(
        controlError instanceof Error
          ? controlError.message
          : "Search control failed"
      );
    } finally {
      setControlling(false);
    }
  };

  const broadenAndRetry = async () => {
    setBroadening(true);
    try {
      const settingsRes = await fetch("/api/preferences");
      const settingsData = await settingsRes.json();
      if (!settingsRes.ok || !settingsData.settings) {
        throw new Error("Could not load your preferences to broaden them");
      }
      const current = settingsData.settings;
      const broadened = {
        ...current,
        matchThreshold: Math.max(40, (current.matchThreshold ?? 70) - 15),
        workModes: current.workModes.includes("REMOTE")
          ? current.workModes
          : [...current.workModes, "REMOTE"],
      };
      const changes: string[] = [];
      if (broadened.matchThreshold !== current.matchThreshold) {
        changes.push(`match threshold lowered to ${broadened.matchThreshold}`);
      }
      if (!current.workModes.includes("REMOTE")) {
        changes.push("remote roles included");
      }
      const putRes = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...broadened, preferencesComplete: true }),
      });
      if (!putRes.ok) throw new Error("Could not save broadened preferences");
      toast.success(
        changes.length > 0
          ? `Broadened search: ${changes.join(", ")}. Re-running…`
          : "Preferences were already at their broadest — re-running…"
      );
      await startRun();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not broaden search");
    } finally {
      setBroadening(false);
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (running) return;
    fetch(`/api/jobs/progress?type=${jobType}`)
      .then((res) => res.json())
      .then((data) => {
        const p = data.progress as JobRunProgress | null;
        if (p) setProgress(p);
        if (
          p &&
          (p.status === "pending" ||
            p.status === "running" ||
            p.status === "pause_requested")
        ) {
          completedRef.current = false;
          setRunning(true);
          setProgress(p);
          setError(null);
          pollRef.current = setInterval(() => {
            void pollProgress();
          }, 1500);
        }
      })
      .catch(() => {});
  }, [jobType, pollProgress, running]);

  const label =
    triggerLabel ?? (mode === "search" ? "Run Job Search" : "Run AI Agent");
  const Icon = mode === "search" ? Search : Bot;

  return (
    <div className={cn("space-y-4", className)}>
      <Button
        onClick={
          progress?.status === "paused"
            ? () => void controlRun("resume")
            : startRun
        }
        disabled={running}
        className="h-11 gap-2 px-5"
        size="default"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {running
          ? "Running…"
          : progress?.status === "paused"
            ? "Resume search"
            : label}
      </Button>

      {running && mode === "search" && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2 h-11 gap-1.5"
            disabled={controlling || progress?.status === "pause_requested"}
            onClick={() => void controlRun("pause")}
          >
            <Pause className="h-4 w-4" />
            {progress?.status === "pause_requested" ? "Pausing…" : "Pause"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2 h-11 gap-1.5"
            disabled={cancelling}
            onClick={() => void cancelRun()}
          >
            <XCircle className="h-4 w-4" />
            {cancelling ? "Cancelling…" : "Cancel search"}
          </Button>
        </>
      )}

      {progress?.status === "paused" && !running && mode === "search" && (
        <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
          <Pause className="h-4 w-4 text-[var(--warning)]" />
          <span className="flex-1 text-[var(--ink-secondary)]">
            Search paused. Existing results remain available and refresh-safe.
          </span>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={controlling}
            onClick={() => void controlRun("resume")}
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        </div>
      )}

      {running && progress && (
        <Card className="border-[var(--accent)]/20 bg-[var(--accent-subtle)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              {progress.stageLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--ink-tertiary)]">
                <span>Progress</span>
                <span>{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatPill
                icon={Search}
                label="Jobs found"
                value={String(progress.jobsFound)}
              />
              <StatPill
                icon={CheckCircle2}
                label="Matched"
                value={String(progress.jobsRelevant)}
              />
              <StatPill
                icon={FileText}
                label="Excluded"
                value={String(progress.jobsExcluded)}
              />
              {progress.currentCompany && (
                <StatPill
                  icon={Building2}
                  label="Company"
                  value={progress.currentCompany}
                  truncate
                />
              )}
              {progress.currentAts && (
                <StatPill icon={FileText} label="ATS" value={progress.currentAts} />
              )}
              {progress.queuePosition != null && progress.queuePosition > 0 && (
                <StatPill
                  icon={ListOrdered}
                  label="Queue"
                  value={`#${progress.queuePosition}`}
                />
              )}
              {progress.estimatedSecondsRemaining != null && (
                <StatPill
                  icon={Clock}
                  label="ETA"
                  value={`~${Math.ceil(progress.estimatedSecondsRemaining / 60)}m`}
                />
              )}
            </div>

            {progress.logs.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--ink-tertiary)]">Live logs</p>
                <div className="space-y-1 font-mono text-[11px]">
                  {progress.logs.map((log, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-[var(--ink-tertiary)]",
                        log.level === "ERROR" && "text-[var(--error)]",
                        log.level === "WARN" && "text-[var(--warning)]"
                      )}
                    >
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {running && !progress && (
        <Card className="border-[var(--accent)]/20">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">Starting…</p>
              <p className="text-xs text-[var(--ink-tertiary)]">Connecting to job search pipeline</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <ErrorCallout
          title={mode === "search" ? "Job search failed" : "Agent run failed"}
          what={error}
          why="The background job encountered an error during processing."
          fix="Check your settings, ensure your resume is uploaded, and try again. View logs for details."
          onRetry={startRun}
          retrying={running}
          logs={progress?.logs.map((l) => l.message)}
        />
      )}

      {progress?.status === "completed" && !running && progress.jobsRelevant > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--success)]/20 bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
          Complete — {progress.jobsRelevant} relevant jobs, {progress.jobsNew} new
        </div>
      )}

      {(progress?.result?.sources?.length ?? 0) > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {progress?.result?.sources?.map((source) => (
              <div
                key={source.source}
                className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[var(--ink)]">
                    {source.source}
                  </p>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      source.success
                        ? "text-[var(--success)]"
                        : "text-[var(--warning)]"
                    )}
                  >
                    {source.success ? "Searched" : "Unavailable"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  {source.success
                    ? `${source.fetched} fetched · ${source.relevant ?? 0} matched${
                        source.durationMs != null
                          ? ` · ${(source.durationMs / 1000).toFixed(1)}s`
                          : ""
                      }`
                    : source.error ?? "This source could not be searched."}
                </p>
              </div>
            ))}
          </div>
        )}

      {progress?.status === "completed" &&
        !running &&
        progress.result?.searchStageCounts && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
            <p className="font-medium text-[var(--ink)]">
              How results were found
            </p>
            <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
              Exact search: {progress.result.searchStageCounts.strict} · Related
              titles: {progress.result.searchStageCounts.balanced} · Recovery
              search: {progress.result.searchStageCounts.recovery}
            </p>
            {progress.result.searchStageCounts.strict === 0 &&
              progress.jobsRelevant > 0 && (
                <p className="mt-2 text-xs text-[var(--accent)]">
                  Exact search returned no matches. These roles were found using
                  related titles or the disclosed recovery search.
                </p>
              )}
          </div>
        )}

      {mode === "search" &&
        progress?.status === "completed" &&
        !running &&
        progress.jobsRelevant === 0 && (
        <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-4 text-sm">
          <p className="font-medium text-[var(--ink)]">
            No jobs matched your current preferences
          </p>
          {(progress.result?.zeroResultDiagnosis?.explanation ?? [
            "The search completed, but no current posting passed your filters.",
          ]).map((message) => (
            <p key={message} className="text-xs text-[var(--ink-tertiary)]">
              {message}
            </p>
          ))}
          {progress.failedSources.length > 0 && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="text-xs font-medium text-[var(--ink)]">Source status</p>
              {progress.failedSources.map((source) => (
                <p key={source.source} className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  {source.source}: unavailable{source.error ? ` — ${source.error}` : ""}
                </p>
              ))}
            </div>
          )}
          {progress.result?.filterImpact &&
            Object.keys(progress.result.filterImpact).length > 0 && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="text-xs font-medium text-[var(--ink)]">Filter impact</p>
                {Object.entries(progress.result.filterImpact)
                  .sort((left, right) => right[1] - left[1])
                  .slice(0, 4)
                  .map(([reason, count]) => (
                    <p key={reason} className="mt-1 text-xs text-[var(--ink-tertiary)]">
                      {reason.replaceAll("_", " ")}: {count}
                    </p>
                  ))}
              </div>
            )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              disabled={broadening}
              onClick={() => void broadenAndRetry()}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {broadening ? "Broadening…" : "Broaden search"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9 gap-1.5" asChild>
              <Link href="/dashboard/settings">
                <Settings className="h-3.5 w-3.5" />
                Edit preferences
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  truncate: shouldTruncate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--ink-tertiary)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn("mt-0.5 text-sm font-semibold text-[var(--ink)] tabular-nums", shouldTruncate && "truncate")}>
        {value}
      </p>
    </div>
  );
}
