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
  publicDiscoveryStatus?: "available" | "setup_required";
  authenticatedConnectionStatus?: "connected" | "connection_required";
  publicDiscoveryProvider?: string | null;
  importSupported?: boolean;
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
  const [testErrors, setTestErrors] = useState<
    Record<string, { status: string; message: string }>
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
      if (!response.ok) {
        setTestErrors((current) => ({
          ...current,
          [source]: {
            status: data.quotaStatus || data.error || "unavailable",
            message: data.message || "Public discovery test failed",
          },
        }));
        throw new Error(data.message || data.error || "Test failed");
      }
      setTestErrors((current) => {
        const next = { ...current };
        delete next[source];
        return next;
      });
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
        const requiresAuth =
          item.authenticatedConnectionStatus === "connection_required" ||
          item.status === "authentication_required";
        const testResult = testResults[item.source];
        const testError = testErrors[item.source];
        const sourceHome =
          item.source === "LINKEDIN"
            ? "https://www.linkedin.com/jobs/"
            : item.source === "NAUKRI"
              ? "https://www.naukri.com/"
              : null;
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
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-3 text-xs text-[var(--ink-secondary)]">
                  {item.publicDiscoveryStatus && (
                    <p>
                      <strong>Public discovery:</strong>{" "}
                      {item.publicDiscoveryStatus === "available"
                        ? `Available via ${item.publicDiscoveryProvider}`
                        : "Setup required"}
                    </p>
                  )}
                  <p>
                    <strong>Authenticated connection:</strong> Connection
                    required. A normal Kairela sign-in does not grant platform
                    Jobs API access.
                  </p>
                  {item.importSupported && (
                    <p>
                      <strong>Imported links:</strong> Available for permitted
                      public metadata and canonical-source preservation.
                    </p>
                  )}
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
              {item.publicDiscoveryStatus && (
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Search-provider quota:{" "}
                  {testError?.status === "exhausted"
                    ? "Exhausted"
                    : testError?.status === "rate_limited"
                      ? "Temporarily rate limited"
                      : testResult
                        ? "Available at last test"
                        : "Not reported until a connection test"}
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
                    {item.publicDiscoveryStatus
                      ? "Test public discovery"
                      : "Test connection"}
                  </Button>
                ) : item.importSupported || requiresAuth ? (
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
                {sourceHome && (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <a href={sourceHome} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open source
                    </a>
                  </Button>
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
