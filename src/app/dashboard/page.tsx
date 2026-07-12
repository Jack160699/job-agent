import { DashboardHeader } from "@/components/dashboard/app-shell";
import { StatCard, MatchScoreBadge, StatusBadge } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Target, Send, Calendar, Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getDashboardStats, getRecentApplications, getUpcomingInterviews } from "@/lib/data/dashboard";
import { formatRelativeTime } from "@/lib/utils";
import { AgentRunButton } from "@/components/dashboard/agent-run-button";

export default async function DashboardOverview() {
  const [stats, recentApps, interviews] = await Promise.all([
    getDashboardStats(),
    getRecentApplications(5),
    getUpcomingInterviews(3),
  ]);

  return (
    <div>
      <DashboardHeader
        title="Overview"
        description="Your job search at a glance"
        actions={
          <div className="flex gap-2">
            <AgentRunButton />
            <Link href="/dashboard/jobs">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search
              </Button>
            </Link>
          </div>
        }
      />

      {/* Compact metric strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard title="Active Jobs" value={stats.activeJobs} icon={<Briefcase />} />
        <StatCard title="Strong Matches" value={stats.strongMatches} description="≥80%" icon={<Target />} />
        <StatCard title="Applications" value={stats.applications} description={`${stats.pendingReview} review`} icon={<Send />} />
        <StatCard title="Interviews" value={stats.interviews} icon={<Calendar />} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-2.5">
            <CardTitle>Recent applications</CardTitle>
            <Link href="/dashboard/applications">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentApps.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--ink-tertiary)]">
                No applications yet — run a job search to get started.
              </p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {recentApps.map((app) => (
                  <div
                    key={app.id}
                    className="row-hover flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {app.job.title}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-tertiary)]">
                        {app.job.company}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {app.matchScore != null && (
                        <MatchScoreBadge score={app.matchScore} size="sm" showLabel={false} />
                      )}
                      <StatusBadge status={app.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-2.5">
            <CardTitle>Upcoming interviews</CardTitle>
            <Link href="/dashboard/calendar">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                Calendar <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {interviews.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--ink-tertiary)]">
                No interviews scheduled.
              </p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="row-hover flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {interview.title}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-tertiary)]">
                        {interview.company}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[var(--accent)] tabular-nums">
                      {formatRelativeTime(interview.scheduledAt)}
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
