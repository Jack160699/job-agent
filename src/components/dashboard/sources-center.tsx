"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SourceCenterItem {
  source: string;
  displayName: string;
  accessMethod: string;
  status: string;
  searchable: boolean;
  explanation: string;
  enabled: boolean;
  jobsStored: number;
  requests: number;
  lastSuccessfulFetch: string | null;
  lastError: string | null;
}

const statusLabels: Record<string, string> = {
  healthy: "Available",
  degraded: "Degraded",
  unavailable: "Unavailable",
  rate_limited: "Rate limited",
  authentication_required: "Authentication required",
  misconfigured: "Setup required",
  blocked: "Blocked",
  no_results: "No results",
  stale: "Stale",
};

function statusTone(status: string): string {
  if (status === "healthy") return "border-[var(--success)]/30 text-[var(--success)]";
  if (status === "authentication_required") {
    return "border-[var(--warning)]/30 text-[var(--warning)]";
  }
  return "border-[var(--line)] text-[var(--ink-secondary)]";
}

export function SourcesCenter({ items }: { items: SourceCenterItem[] }) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { jobs: number; durationMs: number; verifiedAt: string }>
  >({});

  const testConnection = async (source: string) => {
    setTesting(source);
    try {
      const response = await fetch("/api/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || "Test failed");
      setTestResults((current) => ({ ...current, [source]: data }));
      toast.success(
        `${source} responded with ${data.jobs} current query results`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => {
        const requiresAuth = item.status === "authentication_required";
        const testResult = testResults[item.source];
        return (
          <Card key={item.source} className="h-full">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{item.displayName}</CardTitle>
                  <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                    {item.accessMethod}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    statusTone(item.status)
                  )}
                >
                  {item.status === "healthy" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : requiresAuth ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {statusLabels[item.status] ?? item.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="min-h-10 text-sm text-[var(--ink-secondary)]">
                {item.explanation}
              </p>

              {requiresAuth && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-3 text-xs text-[var(--ink-secondary)]">
                  Kairela will continue searching permitted public sources. A
                  LinkedIn sign-in identity does not grant Jobs API access, and
                  Kairela does not treat it as a source connection.
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-[var(--ink-tertiary)]">Enabled in search</dt>
                  <dd className="mt-1 font-medium text-[var(--ink)]">
                    {item.enabled ? "Yes" : "No"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-tertiary)]">Jobs in workspace</dt>
                  <dd className="mt-1 font-medium text-[var(--ink)]">
                    {item.jobsStored}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-tertiary)]">Search attempts</dt>
                  <dd className="mt-1 font-medium text-[var(--ink)]">
                    {item.requests}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--ink-tertiary)]">Last success</dt>
                  <dd className="mt-1 font-medium text-[var(--ink)]">
                    {item.lastSuccessfulFetch
                      ? new Date(item.lastSuccessfulFetch).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
              </dl>

              {item.lastError && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                  <p className="text-xs font-medium text-[var(--ink)]">Last error</p>
                  <p className="mt-1 break-words text-xs text-[var(--ink-tertiary)]">
                    {item.lastError}
                  </p>
                </div>
              )}

              {testResult && (
                <p className="text-xs text-[var(--success)]" role="status">
                  Test passed: {testResult.jobs} results in {testResult.durationMs} ms
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {item.searchable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={testing != null}
                    onClick={() => void testConnection(item.source)}
                  >
                    {testing === item.source ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Test connection
                  </Button>
                ) : requiresAuth ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href="/dashboard/jobs">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Import a job link
                    </Link>
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-tertiary)]">
                    <CircleOff className="h-3.5 w-3.5" />
                    No safe connection method configured
                  </span>
                )}
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href="/dashboard/settings">Change source settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
