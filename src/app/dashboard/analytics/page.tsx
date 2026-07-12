import { DashboardHeader } from "@/components/dashboard/sidebar";
import { StatCard } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/lib/data/dashboard";
import { Progress } from "@/components/ui/progress";
import { BarChart3 } from "lucide-react";

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  return (
    <div>
      <DashboardHeader
        title="Analytics"
        description="Job search performance and insights"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Jobs" value={analytics.totalJobs} />
        <StatCard title="Applications" value={analytics.totalApplications} />
        <StatCard
          title="Avg Match Score"
          value={`${Math.round(analytics.avgMatchScore)}%`}
        />
        <StatCard
          title="Conversion Rate"
          value={`${analytics.conversionRate}%`}
          description="Applications submitted"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Application Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FunnelBar
              label="Submitted"
              value={analytics.submitted}
              total={analytics.totalApplications}
              color="bg-violet-500"
            />
            <FunnelBar
              label="Interviewing"
              value={analytics.interviewing}
              total={analytics.totalApplications}
              color="bg-pink-500"
            />
            <FunnelBar
              label="Offered"
              value={analytics.offered}
              total={analytics.totalApplications}
              color="bg-emerald-500"
            />
            <FunnelBar
              label="Rejected"
              value={analytics.rejected}
              total={analytics.totalApplications}
              color="bg-red-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.sourceBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-500">No data yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.sourceBreakdown.map((item) => (
                  <div key={item.source} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{item.source}</span>
                    <span className="text-sm font-medium text-zinc-100">
                      {item._count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200">
          {value} ({Math.round(pct)}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
