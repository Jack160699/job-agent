import { DashboardHeader } from "@/components/dashboard/sidebar";
import { StatCard } from "@/components/dashboard/shared";
import { AnimatedCard, StaggerContainer, StaggerItem } from "@/components/ui/animated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchScoreBadge, StatusBadge } from "@/components/dashboard/shared";
import {
  Briefcase,
  Target,
  Send,
  Calendar,
  Search,
  Plus,
} from "lucide-react";
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
        description="Your job search command center"
        actions={
          <div className="flex gap-2">
            <AgentRunButton />
            <Link href="/dashboard/jobs">
              <Button variant="outline" className="gap-2">
                <Search className="h-4 w-4" />
                Search Jobs
              </Button>
            </Link>
          </div>
        }
      />

      <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <StatCard
            title="Active Jobs"
            value={stats.activeJobs}
            description="Discovered this week"
            icon={<Briefcase className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Strong Matches"
            value={stats.strongMatches}
            description="Score ≥ 80%"
            icon={<Target className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Applications"
            value={stats.applications}
            description={`${stats.pendingReview} pending review`}
            icon={<Send className="h-5 w-5" />}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Interviews"
            value={stats.interviews}
            description="Upcoming"
            icon={<Calendar className="h-5 w-5" />}
          />
        </StaggerItem>
      </StaggerContainer>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AnimatedCard delay={0.2}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Applications</CardTitle>
              <Link href="/dashboard/applications">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentApps.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No applications yet. Start by searching for jobs.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-4"
                    >
                      <div>
                        <p className="font-medium text-zinc-200">
                          {app.job.title}
                        </p>
                        <p className="text-sm text-zinc-500">{app.job.company}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {app.matchScore && (
                          <MatchScoreBadge score={app.matchScore} size="sm" />
                        )}
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>

        <AnimatedCard delay={0.3}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming Interviews</CardTitle>
              <Link href="/dashboard/calendar">
                <Button variant="ghost" size="sm">View calendar</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No interviews scheduled yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {interviews.map((interview) => (
                    <div
                      key={interview.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-4"
                    >
                      <div>
                        <p className="font-medium text-zinc-200">
                          {interview.title}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {interview.company}
                        </p>
                      </div>
                      <p className="text-sm text-violet-400">
                        {formatRelativeTime(interview.scheduledAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>

      <AnimatedCard delay={0.4} className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link href="/dashboard/resumes">
                <Button variant="outline" className="h-auto w-full flex-col gap-2 py-6">
                  <Plus className="h-5 w-5" />
                  <span>Upload Resume</span>
                </Button>
              </Link>
              <Link href="/dashboard/jobs">
                <Button variant="outline" className="h-auto w-full flex-col gap-2 py-6">
                  <Search className="h-5 w-5" />
                  <span>Search Jobs</span>
                </Button>
              </Link>
              <Link href="/dashboard/settings">
                <Button variant="outline" className="h-auto w-full flex-col gap-2 py-6">
                  <Target className="h-5 w-5" />
                  <span>Configure Filters</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
