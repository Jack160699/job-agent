"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Database, ListOrdered } from "lucide-react";

interface HealthData {
  status: string;
  database: string;
  queue?: Record<string, number>;
  timestamp: string;
}

export function AdminOpsClient() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [queueStats, setQueueStats] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});

    fetch("/api/admin/queue")
      .then((r) => r.json())
      .then((d) => setQueueStats(d.stats ?? {}))
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

      {health?.timestamp && (
        <p className="text-xs text-[var(--ink-tertiary)]">
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
