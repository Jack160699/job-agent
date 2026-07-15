import { DashboardHeader } from "@/components/dashboard/sidebar";
import { MatchScoreBadge, StatusBadge, EmptyState } from "@/components/dashboard/shared";
import { ApplicationActions } from "@/components/dashboard/application-actions";
import { Card, CardContent } from "@/components/ui/card";
import { getApplications } from "@/lib/data/dashboard";
import { ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { JobLinkImportButton } from "@/components/jobs/job-link-import";
import {
  applicationTimeline,
  nextApplicationAction,
} from "@/lib/applications/state-machine";

export default async function ApplicationsPage() {
  const applications = await getApplications();

  return (
    <div>
      <DashboardHeader
        title="Application Tracker"
        description="Track every job application and its status"
        actions={<JobLinkImportButton compact />}
      />

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Applications are created automatically when jobs are discovered and processed."
          icon={<ClipboardList className="h-8 w-8" />}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {applications.map((app) => (
              <Card key={app.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--ink)] truncate">{app.job.title}</p>
                      <p className="text-sm text-[var(--ink-tertiary)]">{app.job.company}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="mt-3 rounded-md bg-[var(--surface-sunken)] p-3 text-xs">
                    <p>
                      <span className="font-medium">Documents:</span>{" "}
                      {app.tailoredResume && app.coverLetter
                        ? "Tailored resume and cover letter ready"
                        : "Documents still required"}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Next:</span>{" "}
                      {nextApplicationAction({
                        status: app.status,
                        hasDocuments: Boolean(
                          app.tailoredResume && app.coverLetter
                        ),
                        failureReason: app.failureReason,
                      })}
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">Timeline</summary>
                      <ol className="mt-1 space-y-1 text-[var(--ink-tertiary)]">
                        {applicationTimeline(app).map((event) => (
                          <li key={`${event.label}-${event.at.toISOString()}`}>
                            {event.label} · {formatDate(event.at)}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {app.matchScore != null ? (
                        <MatchScoreBadge score={app.matchScore} size="sm" />
                      ) : (
                        <span className="text-xs text-[var(--ink-tertiary)]">No score</span>
                      )}
                      <span className="text-xs text-[var(--ink-tertiary)]">{formatDate(app.updatedAt)}</span>
                    </div>
                    <ApplicationActions
                      applicationId={app.id}
                      status={app.status}
                      failureReason={app.failureReason}
                      jobStatus={app.job.status}
                      hasDocuments={Boolean(app.tailoredResume && app.coverLetter)}
                      browserTaskId={
                        ((app.documents as { browserTaskId?: string } | null)
                          ?.browserTaskId) ?? null
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-[var(--line)] md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-sunken)]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Match</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Documents / next action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className="border-b border-[var(--line)]/50 transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[var(--ink)]">{app.job.title}</td>
                    <td className="px-6 py-4 text-sm text-[var(--ink-tertiary)]">{app.job.company}</td>
                    <td className="px-6 py-4">
                      {app.matchScore != null ? (
                        <MatchScoreBadge score={app.matchScore} size="sm" />
                      ) : (
                        <span className="text-xs text-[var(--ink-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--ink-tertiary)]">{formatDate(app.updatedAt)}</td>
                    <td className="max-w-[260px] px-6 py-4 text-xs">
                      <p>
                        {app.tailoredResume && app.coverLetter
                          ? "Resume + cover letter ready"
                          : "Documents required"}
                      </p>
                      <p className="mt-1 text-[var(--ink-tertiary)]">
                        {nextApplicationAction({
                          status: app.status,
                          hasDocuments: Boolean(
                            app.tailoredResume && app.coverLetter
                          ),
                          failureReason: app.failureReason,
                        })}
                      </p>
                      <details className="mt-1">
                        <summary className="cursor-pointer">Timeline</summary>
                        <ol className="mt-1 space-y-1">
                          {applicationTimeline(app).map((event) => (
                            <li key={`${event.label}-${event.at.toISOString()}`}>
                              {event.label} · {formatDate(event.at)}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </td>
                    <td className="px-6 py-4">
                      <ApplicationActions
                        applicationId={app.id}
                        status={app.status}
                        failureReason={app.failureReason}
                        jobStatus={app.job.status}
                        hasDocuments={Boolean(app.tailoredResume && app.coverLetter)}
                        browserTaskId={
                          ((app.documents as { browserTaskId?: string } | null)
                            ?.browserTaskId) ?? null
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
