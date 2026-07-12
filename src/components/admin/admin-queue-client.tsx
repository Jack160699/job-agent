"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";

interface QueueJob {
  id: string;
  type: string;
  status: string;
  priority: number;
  source: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  progressStage: string | null;
  progressPercent: number;
  queuedAt: string;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export function AdminQueueClient() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<QueueJob[]>([]);
  const [deadLetter, setDeadLetter] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/queue");
      if (!res.ok) throw new Error("Failed to load queue");
      const data = await res.json();
      setStats(data.stats ?? {});
      setRecent(data.recent ?? []);
      setDeadLetter(data.deadLetter ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const adminAction = async (action: string, jobId?: string) => {
    const res = await fetch("/api/admin/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobId }),
    });
    if (!res.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success("Queue updated");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={load} disabled={loading} variant="outline" className="h-11 gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          onClick={() => adminAction("recover_stale")}
          variant="outline"
          className="h-11 gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Recover stale jobs
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Object.entries(stats).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="p-3">
              <p className="text-xs text-[var(--ink-tertiary)]">{status}</p>
              <p className="text-lg font-semibold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {deadLetter.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--ink)]">Dead letter ({deadLetter.length})</h2>
          <div className="space-y-2">
            {deadLetter.map((job) => (
              <JobRow key={job.id} job={job} onRetry={() => adminAction("retry", job.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--ink)]">Recent jobs</h2>
        <div className="space-y-2">
          {recent.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onRetry={() => adminAction("retry", job.id)}
              onCancel={() => adminAction("cancel", job.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
}: {
  job: QueueJob;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const claimLatency =
    job.claimedAt && job.queuedAt
      ? new Date(job.claimedAt).getTime() - new Date(job.queuedAt).getTime()
      : null;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-medium">{job.type}</span>
          <span className="ml-2 text-xs text-[var(--ink-tertiary)]">{job.status}</span>
          {job.progressStage && (
            <span className="ml-2 text-xs text-[var(--ink-secondary)]">
              {job.progressStage} ({job.progressPercent}%)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onRetry && (job.status === "failed" || job.status === "dead_letter") && (
            <Button size="sm" variant="outline" className="h-9" onClick={onRetry}>
              Retry
            </Button>
          )}
          {onCancel && (job.status === "pending" || job.status === "running") && (
            <Button size="sm" variant="outline" className="h-9 gap-1" onClick={onCancel}>
              <XCircle className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
        {formatRelativeTime(new Date(job.createdAt))}
        {claimLatency != null ? ` · claim ${Math.round(claimLatency / 1000)}s` : ""}
        {job.attempts > 0 ? ` · attempts ${job.attempts}/${job.maxAttempts}` : ""}
      </p>
      {job.error && (
        <p className="mt-1 text-xs text-[var(--danger)] line-clamp-2">{job.error}</p>
      )}
    </div>
  );
}
