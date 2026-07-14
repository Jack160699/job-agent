import { DashboardHeader } from "@/components/dashboard/sidebar";
import { MatchScoreBadge, StatusBadge, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getJobs, getExcludedJobs, getUserSettings } from "@/lib/data/dashboard";
import { Search, ExternalLink, MapPin } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { JobsPageClient } from "@/components/dashboard/jobs-page-client";
import prisma from "@/lib/db";
import { getDbUser } from "@/lib/auth/server";
import { JobLinkImportButton } from "@/components/jobs/job-link-import";
import { JobFeedbackControl } from "@/components/jobs/job-feedback";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showExcluded = view === "excluded";
  const user = await getDbUser();
  const [jobs, excludedJobs, settings] = await Promise.all([
    showExcluded ? Promise.resolve([]) : getJobs(),
    showExcluded ? getExcludedJobs() : Promise.resolve([]),
    getUserSettings(),
  ]);
  const displayJobs = showExcluded ? excludedJobs : jobs;

  let lastSearchAt: string | null = null;
  let lastResultCount = 0;

  if (user) {
    const lastJob = await prisma.backgroundJob.findFirst({
      where: {
        userId: user.id,
        type: "SEARCH_JOBS",
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
    });
    if (lastJob?.completedAt) {
      lastSearchAt = formatRelativeTime(lastJob.completedAt);
      const meta = lastJob.progressMeta as { relevant?: number } | null;
      lastResultCount = meta?.relevant ?? 0;
    }
  }

  return (
    <div>
      <DashboardHeader
        title="Job Search"
        description="Jobs matched to your preferences"
        actions={<JobLinkImportButton />}
      />

      <JobsPageClient
        preferencesComplete={settings?.preferencesComplete ?? false}
        lastSearchAt={lastSearchAt}
        lastResultCount={lastResultCount}
        activeView={showExcluded ? "excluded" : "matches"}
      />

      <div id="job-results" className="mt-6">
        {displayJobs.length === 0 ? (
          <EmptyState
            title={showExcluded ? "No excluded jobs saved" : "No matching jobs yet"}
            description={
              showExcluded
                ? "Jobs filtered out by your preferences appear here with the exclusion reason."
                : settings?.preferencesComplete
                  ? "Run a job search to discover roles that match your preferences."
                  : "Complete your job search preferences, then run a search."
            }
            icon={<Search className="h-8 w-8" />}
          />
        ) : (
          <div className="space-y-4">
            {displayJobs.map((job) => {
              const analysis = job.matchAnalysis as {
                reasons?: string[];
                exclusions?: string[];
                classification?: string;
                recommendation?: string;
              } | null;
              return (
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
                      {analysis?.reasons && analysis.reasons.length > 0 && (
                        <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                          {showExcluded ? "Excluded:" : "Match:"}{" "}
                          {(showExcluded
                            ? analysis.exclusions
                            : analysis.reasons
                          )
                            ?.slice(0, 2)
                            .join(" · ")}
                        </p>
                      )}
                      {analysis?.classification && (
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">
                          {analysis.classification.replace(/_/g, " ")}
                        </p>
                      )}
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
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                      {job.applications?.[0] && (
                        <StatusBadge status={job.applications[0].status} />
                      )}
                      <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                      </div>
                      <JobFeedbackControl
                        jobId={job.id}
                        initialFeedback={
                          job.feedback[0]
                            ? {
                                relevant: job.feedback[0].relevant,
                                reason: job.feedback[0].reason,
                              }
                            : null
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
