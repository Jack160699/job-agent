"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Bot,
  Building2,
  Clock,
  ListOrdered,
  FileText,
  CheckCircle2,
  Loader2,
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

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

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

      {running && progress && (
        <Card className="border-violet-500/20 bg-violet-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              {progress.stageLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
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
              <div className="max-h-36 overflow-y-auto rounded-lg bg-zinc-950/60 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-500">Live logs</p>
                <div className="space-y-1 font-mono text-[11px]">
                  {progress.logs.map((log, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-zinc-500",
                        log.level === "ERROR" && "text-red-400",
                        log.level === "WARN" && "text-amber-400"
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
        <Card className="border-violet-500/20">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Starting…</p>
              <p className="text-xs text-zinc-500">Connecting to job search pipeline</p>
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

      {progress?.status === "completed" && !running && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Complete — {progress.jobsFound} jobs found, {progress.jobsNew} new
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
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn("mt-0.5 text-sm font-semibold text-zinc-200", shouldTruncate && "truncate")}>
        {value}
      </p>
    </div>
  );
}
