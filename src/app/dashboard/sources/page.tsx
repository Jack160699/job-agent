import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getDbUser } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/sidebar";
import {
  SourcesCenter,
  type SourceCenterItem,
} from "@/components/dashboard/sources-center";
import {
  getPublicProviderDiagnostics,
  getSourceCapabilities,
} from "@/lib/jobs/source-capabilities";

export default async function SourcesPage() {
  const user = await getDbUser();
  if (!user) redirect("/login");

  const [settings, health, counts] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.jobSourceHealth.findMany({ where: { userId: user.id } }),
    prisma.job.groupBy({
      by: ["source"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const healthBySource = new Map(health.map((item) => [item.source, item]));
  const countBySource = new Map(
    counts.map((item) => [item.source, item._count._all])
  );
  const discovery = getPublicProviderDiagnostics();
  const items: SourceCenterItem[] = Object.values(getSourceCapabilities()).map(
    (capability) => {
      const state = healthBySource.get(capability.source);
      return {
        ...capability,
        enabled: settings?.enabledSources.includes(capability.source) ?? false,
        jobsStored: countBySource.get(capability.source) ?? 0,
        requests: state?.requests ?? 0,
        lastSuccessfulFetch:
          state?.lastSuccessfulFetch?.toISOString() ?? null,
        lastError: state?.lastError ?? null,
      };
    }
  );

  const serper = discovery.serper;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Job sources"
        description="See exactly what Kairela can search, what needs authentication, and why a source may be unavailable."
      />
      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
        <h2 className="text-base font-semibold text-[var(--ink)]">
          Public search provider
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Server-side discovery only. API keys are never exposed to the browser.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <dt className="text-[var(--ink-tertiary)]">Primary provider</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {discovery.provider ?? "None configured"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Serper status</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {serper?.configured
                ? serper.status.replaceAll("_", " ")
                : "not configured"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Last successful request</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {serper?.lastSuccessfulRequestAt ?? "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Last duration / results</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {serper?.lastDurationMs != null
                ? `${serper.lastDurationMs} ms / ${serper.lastResultCount ?? 0} results`
                : "No live request yet"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Searches used (runtime)</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {serper?.searchesUsed ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Cache hits (runtime)</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {serper?.cacheHits ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Per-run limit</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {discovery.creditLimits.maxQueriesPerRun}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-tertiary)]">Per-user daily limit</dt>
            <dd className="mt-1 font-medium text-[var(--ink)]">
              {discovery.creditLimits.maxQueriesPerUserDay}
            </dd>
          </div>
        </dl>
      </section>
      <SourcesCenter items={items} />
    </div>
  );
}
