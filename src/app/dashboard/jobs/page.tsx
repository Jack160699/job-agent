import { DashboardHeader } from "@/components/dashboard/sidebar";
import { MatchScoreBadge, StatusBadge, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getJobs } from "@/lib/data/dashboard";
import { Search, ExternalLink, MapPin } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { JobSearchActions } from "@/components/dashboard/job-search-actions";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div>
      <DashboardHeader
        title="Job Search"
        description="Discovered jobs from all configured sources"
        actions={<JobSearchActions />}
      />

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs discovered yet"
          description="Configure your search filters in Settings and run a job search to discover opportunities."
          icon={<Search className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="transition-colors hover:border-[var(--line-strong)]">
              <CardContent className="flex items-start justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-[var(--ink)]">
                      {job.title}
                    </h3>
                    {job.matchScore != null && (
                      <MatchScoreBadge score={job.matchScore} size="sm" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-tertiary)]">{job.company}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-tertiary)]">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    <span className="rounded bg-[var(--surface-sunken)] px-2 py-0.5">
                      {job.source}
                    </span>
                    <span>{formatRelativeTime(job.discoveredAt)}</span>
                  </div>
                  {job.requiredSkills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.requiredSkills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs text-[var(--accent)]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {job.applications[0] && (
                    <StatusBadge status={job.applications[0].status} />
                  )}
                  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
