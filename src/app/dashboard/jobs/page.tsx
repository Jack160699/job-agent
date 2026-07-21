import { DashboardHeader } from "@/components/dashboard/sidebar";
import { StatusBadge, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getJobsForView,
  getUserSettings,
  type JobResultsView,
} from "@/lib/data/dashboard";
import {
  Search,
  ExternalLink,
  MapPin,
  BriefcaseBusiness,
  Landmark,
  CalendarClock,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { JobsPageClient } from "@/components/dashboard/jobs-page-client";
import prisma from "@/lib/db";
import { getDbUser } from "@/lib/auth/server";
import { JobLinkImportButton } from "@/components/jobs/job-link-import";
import { JobFeedbackControl } from "@/components/jobs/job-feedback";
import { JobResultActions } from "@/components/jobs/job-result-actions";
import { JobDispositionActions } from "@/components/jobs/job-disposition-actions";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supportedViews: JobResultsView[] = [
    "recommended",
    "possible",
    "saved",
    "imported",
    "excluded",
    "expired",
  ];
  const activeView = supportedViews.includes(view as JobResultsView)
    ? (view as JobResultsView)
    : "recommended";
  const user = await getDbUser();
  // These three only depend on user.id, not on each other's results — run
  // them concurrently instead of stacking a third sequential round trip
  // after the first two resolve.
  const [displayJobs, settings, lastJob] = await Promise.all([
    getJobsForView(activeView),
    getUserSettings(),
    user
      ? prisma.backgroundJob.findFirst({
          where: { userId: user.id, type: "SEARCH_JOBS", status: "completed" },
          orderBy: { completedAt: "desc" },
        })
      : Promise.resolve(null),
  ]);

  let lastSearchAt: string | null = null;
  let lastResultCount = 0;
  if (lastJob?.completedAt) {
    lastSearchAt = formatRelativeTime(lastJob.completedAt);
    const meta = lastJob.progressMeta as { relevant?: number } | null;
    lastResultCount = meta?.relevant ?? 0;
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
        activeView={activeView}
      />

      <div id="job-results" className="mt-6">
        {displayJobs.length === 0 ? (
          <EmptyState
            title={`No ${activeView} jobs`}
            description={
              activeView === "excluded"
                ? "Jobs filtered out by your preferences appear here with the exclusion reason."
                : activeView === "expired"
                  ? "Expired or removed jobs appear here instead of disappearing from saved history."
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
                concerns?: string[];
                uncertain?: string[];
                requiresVerification?: boolean;
                matchedSignals?: string[];
                unknownSignals?: string[];
              } | null;
              const application = job.applications?.[0];
              const metadata = job.metadata as {
                jobType?: string;
                advertisementNumber?: string;
                officialSource?: string;
                verificationStatus?: string;
                searchStage?: "strict" | "balanced" | "recovery";
                searchQuery?: string;
                qualification?: string;
                ageCriteria?: string;
                vacancyCount?: number;
                payLevel?: string;
                notificationPdfUrl?: string;
                applicationUrl?: string;
              } | null;
              const governmentJob = metadata?.jobType === "government";
              return (
                <Card
                  key={job.id}
                  data-testid={`job-card-${job.id}`}
                  className="transition-colors hover:border-[var(--line-strong)]"
                >
                  <CardContent className="flex flex-col items-start justify-between gap-4 p-4 lg:flex-row">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-[var(--ink)]">
                          {job.title}
                        </h3>
                        {analysis?.classification && (
                          <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                            {analysis.classification ===
                            "POTENTIAL_MATCH_REQUIRES_VERIFICATION"
                              ? "Needs verification"
                              : analysis.classification}
                          </span>
                        )}
                        {(analysis?.requiresVerification ||
                          analysis?.classification ===
                            "POTENTIAL_MATCH_REQUIRES_VERIFICATION") && (
                          <span className="rounded-full border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                            Open source to verify
                          </span>
                        )}
                        {metadata?.searchStage && (
                          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-secondary)]">
                            {metadata.searchStage === "strict"
                              ? "Exact search"
                              : metadata.searchStage === "balanced"
                                ? "Related title"
                                : "Recovery search"}
                          </span>
                        )}
                        {governmentJob && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                            <Landmark className="h-3 w-3" />
                            Official government source
                          </span>
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
                        {job.workMode !== "UNKNOWN" && (
                          <span>{job.workMode.toLowerCase()}</span>
                        )}
                        {job.employmentType !== "UNKNOWN" && (
                          <span className="flex items-center gap-1">
                            <BriefcaseBusiness className="h-3 w-3" />
                            {job.employmentType.toLowerCase().replace(/_/g, " ")}
                          </span>
                        )}
                        <span>
                          {job.postedAt
                            ? `Posted ${formatRelativeTime(job.postedAt)}`
                            : `Found ${formatRelativeTime(job.discoveredAt)}`}
                        </span>
                        {job.closesAt && (
                          <span className="flex items-center gap-1 font-medium text-[var(--warning)]">
                            <CalendarClock className="h-3 w-3" />
                            Apply by{" "}
                            {new Intl.DateTimeFormat("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(job.closesAt)}
                          </span>
                        )}
                      </div>
                      {(analysis?.requiresVerification ||
                        analysis?.classification ===
                          "POTENTIAL_MATCH_REQUIRES_VERIFICATION") && (
                        <p className="mt-2 text-xs text-[var(--warning)]">
                          Potential match — open the original source to verify
                          unknown requirements
                          {analysis?.unknownSignals?.length
                            ? ` (${analysis.unknownSignals
                                .slice(0, 4)
                                .join(", ")})`
                            : ""}
                          .
                        </p>
                      )}
                      {governmentJob && (
                        <div className="mt-2 space-y-1 text-xs text-[var(--ink-secondary)]">
                          <p>
                            {metadata?.officialSource}
                            {metadata?.advertisementNumber
                              ? ` · ${metadata.advertisementNumber}`
                              : ""}
                            {metadata?.verificationStatus ===
                            "official_page_unverified_deadline"
                              ? " · Deadline not stated on the listing page—verify the official notice"
                              : ""}
                          </p>
                          {metadata?.qualification && (
                            <p>Qualification: {metadata.qualification}</p>
                          )}
                          {metadata?.ageCriteria && (
                            <p>Age criteria: {metadata.ageCriteria}</p>
                          )}
                          {metadata?.vacancyCount != null && (
                            <p>Vacancies: {metadata.vacancyCount}</p>
                          )}
                          {metadata?.payLevel && <p>Pay level: {metadata.payLevel}</p>}
                          <div className="flex flex-wrap gap-3 pt-1">
                            {metadata?.notificationPdfUrl && (
                              <a
                                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                                href={metadata.notificationPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Official notification PDF
                              </a>
                            )}
                            {metadata?.applicationUrl && (
                              <a
                                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                                href={metadata.applicationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Official application
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      {(job.salaryMin != null || job.salaryMax != null) && (
                        <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                          Salary: {job.salaryCurrency ?? "Currency unknown"}{" "}
                          {[job.salaryMin, job.salaryMax]
                            .filter((value) => value != null)
                            .join(" – ")}
                        </p>
                      )}
                      {(job.experienceMin != null || job.experienceMax != null) && (
                        <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                          Experience:{" "}
                          {[job.experienceMin, job.experienceMax]
                            .filter((value) => value != null)
                            .join("–")}{" "}
                          years
                        </p>
                      )}
                      {job.provenance?.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                          Sources:{" "}
                          {[
                            ...new Set(
                              job.provenance.map((entry) => entry.source)
                            ),
                          ].join(" · ")}
                        </p>
                      )}
                      {analysis?.reasons && analysis.reasons.length > 0 && (
                        <p className="mt-2 text-xs text-[var(--ink-secondary)]">
                          {activeView === "excluded" ? "Excluded:" : "Match:"}{" "}
                          {(activeView === "excluded"
                            ? analysis.exclusions
                            : analysis.reasons
                          )
                            ?.slice(0, 2)
                            .join(" · ")}
                        </p>
                      )}
                      {(analysis?.concerns?.length ||
                        analysis?.uncertain?.length) && (
                        <p className="mt-1 text-xs text-[var(--warning)]">
                          Important gaps:{" "}
                          {[...(analysis.concerns ?? []), ...(analysis.uncertain ?? [])]
                            .slice(0, 2)
                            .join(" · ")}
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
                    <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:items-end">
                      <div className="flex items-center gap-2">
                      {job.applications?.[0] && (
                        <StatusBadge status={job.applications[0].status} />
                      )}
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open original posting for ${job.title} at ${job.company}`}
                      >
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
                      <JobDispositionActions
                        jobId={job.id}
                        saved={Boolean(job.savedAt)}
                        excluded={job.status === "ARCHIVED"}
                      />
                      <JobResultActions
                        job={{
                          id: job.id,
                          title: job.title,
                          company: job.company,
                          status: job.status,
                        }}
                        application={
                          application
                            ? {
                                id: application.id,
                                status: application.status,
                                failureReason: application.failureReason,
                                hasDocuments: Boolean(
                                  application.tailoredResume &&
                                    application.coverLetter
                                ),
                              }
                            : undefined
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
