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
  status: "pending" | "running" | "completed" | "failed";
  stage: string;
  stageLabel: string;
  progress: number;
  jobsFound: number;
  jobsNew: number;
  currentCompany: string | null;
  currentAts: string | null;
  queuePosition: number | null;
  estimatedSecondsRemaining: number | null;
  logs: Array<{ time: string; level: string; message: string }>;
  error: string | null;
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
          currentCompany: null,
          currentAts: null,
          queuePosition: null,
          estimatedSecondsRemaining: null,
          logs: [],
          error: null,
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
        if (p && (p.status === "pending" || p.status === "running")) {
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
        onClick={startRun}
        disabled={running}
        className="h-11 gap-2 px-5"
        size="default"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {running ? "Running…" : label}
      </Button>

      {running && mode === "search" && (
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
                label="New"
                value={String(progress.jobsNew)}
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

      {progress?.status === "completed" && !running && progress.jobsFound > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--success)]/20 bg-[var(--success-muted)] px-4 py-3 text-sm text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
          Complete — {progress.jobsFound} jobs found, {progress.jobsNew} new
        </div>
      )}

      {mode === "search" && progress?.status === "completed" && !running && progress.jobsFound === 0 && (
        <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-4 text-sm">
          <p className="font-medium text-[var(--ink)]">No jobs matched your current preferences</p>
          <p className="text-xs text-[var(--ink-tertiary)]">
            Sources were searched but nothing cleared your title, location, and skill filters this run.
            Broaden your preferences or edit them directly, then run the search again.
          </p>
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
