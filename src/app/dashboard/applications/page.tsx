import { DashboardHeader } from "@/components/dashboard/sidebar";
import { MatchScoreBadge, StatusBadge, EmptyState } from "@/components/dashboard/shared";
import { ApplicationActions } from "@/components/dashboard/application-actions";
import { Card, CardContent } from "@/components/ui/card";
import { getApplications } from "@/lib/data/dashboard";
import { ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ApplicationsPage() {
  const applications = await getApplications();

  return (
    <div>
      <DashboardHeader
        title="Application Tracker"
        description="Track every job application and its status"
      />

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Applications are created automatically when jobs are discovered and processed."
          icon={<ClipboardList className="h-8 w-8" />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Match
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/30"
                >
                  <td className="px-6 py-4 text-sm font-medium text-zinc-200">
                    {app.job.title}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {app.job.company}
                  </td>
                  <td className="px-6 py-4">
                    {app.matchScore != null ? (
                      <MatchScoreBadge score={app.matchScore} size="sm" />
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500">
                    {formatDate(app.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <ApplicationActions
                      applicationId={app.id}
                      status={app.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
