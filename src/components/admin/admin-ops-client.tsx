"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatIndiaDateTime } from "@/lib/utils";
import { Activity, Database, ListOrdered } from "lucide-react";

interface HealthData {
  status: string;
  database: string;
  queue?: Record<string, number>;
  timestamp: string;
}

interface SourceHealth {
  id: string;
  source: string;
  requests: number;
  failures: number;
  duplicateJobs: number;
  expiredJobs: number;
  lastSuccessfulFetch: string | null;
  disabledUntil: string | null;
  rates: {
    failureRate: number;
    emptyRate: number;
    duplicateRate: number;
    expiredRate: number;
    averageRelevance: number | null;
  };
}

export function AdminOpsClient() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [queueStats, setQueueStats] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<SourceHealth[]>([]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});

    fetch("/api/admin/queue")
      .then((r) => r.json())
      .then((d) => setQueueStats(d.stats ?? {}))
      .catch(() => {});

    fetch("/api/admin/search-sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--ink-tertiary)]">Health</p>
              <p className="font-semibold">{health?.status ?? "…"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--ink-tertiary)]">Database</p>
              <p className="font-semibold">{health?.database ?? "…"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <ListOrdered className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--ink-tertiary)]">Queue pending</p>
              <p className="font-semibold">{queueStats.pending ?? health?.queue?.pending ?? "…"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link href="/dashboard/admin/queue">Queue operations</Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/api/health" target="_blank">
            Raw health JSON
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-[var(--ink)]">Search source health</h2>
          <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
            Per-user provider reliability and relevance diagnostics. Cooldowns are
            temporary and recover with a probe after expiry.
          </p>
          {sources.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--ink-tertiary)]">
              No source-health samples yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-[var(--ink-tertiary)]">
                  <tr>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">Requests</th>
                    <th className="pb-2">Failure</th>
                    <th className="pb-2">Empty</th>
                    <th className="pb-2">Duplicates</th>
                    <th className="pb-2">Expired</th>
                    <th className="pb-2">Relevance</th>
                    <th className="pb-2">Last success</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id} className="border-t border-[var(--line)]">
                      <td className="py-2 font-medium">{source.source}</td>
                      <td>{source.requests}</td>
                      <td>{Math.round(source.rates.failureRate * 100)}%</td>
                      <td>{Math.round(source.rates.emptyRate * 100)}%</td>
                      <td>{source.duplicateJobs}</td>
                      <td>{source.expiredJobs}</td>
                      <td>
                        {source.rates.averageRelevance == null
                          ? "—"
                          : Math.round(source.rates.averageRelevance)}
                      </td>
                      <td>
                        {source.lastSuccessfulFetch
                          ? formatIndiaDateTime(source.lastSuccessfulFetch)
                          : "Never"}
                      </td>
                      <td>
                        {source.disabledUntil &&
                        new Date(source.disabledUntil) > new Date()
                          ? "Cooldown"
                          : "Enabled"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {health?.timestamp && (
        <p className="text-xs text-[var(--ink-tertiary)]">
          Last checked: {formatIndiaDateTime(health.timestamp)}
        </p>
      )}
    </div>
  );
}
