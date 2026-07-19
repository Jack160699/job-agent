import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getDbUser } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/sidebar";
import {
  SourcesCenter,
  type SourceCenterItem,
} from "@/components/dashboard/sources-center";
import { SOURCE_CAPABILITIES } from "@/lib/jobs/source-capabilities";

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
  const items: SourceCenterItem[] = Object.values(SOURCE_CAPABILITIES).map(
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

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Job sources"
        description="See exactly what Kairela can search, what needs authentication, and why a source may be unavailable."
      />
      <SourcesCenter items={items} />
    </div>
  );
}
