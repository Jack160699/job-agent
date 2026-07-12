import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { getAuditLogs } from "@/lib/data/dashboard";
import { ScrollText } from "lucide-react";
import { formatDate } from "@/lib/utils";

const levelColors: Record<string, string> = {
  DEBUG: "text-[var(--ink-tertiary)]",
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
  AUDIT: "text-[var(--accent)]",
};

export default async function LogsPage() {
  const logs = await getAuditLogs();

  return (
    <div>
      <DashboardHeader
        title="Audit Logs"
        description="System activity and audit trail"
      />

      {logs.length === 0 ? (
        <EmptyState
          title="No logs yet"
          description="Activity logs will appear here as you use the application."
          icon={<ScrollText className="h-8 w-8" />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-sunken)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--ink-tertiary)]">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-[var(--line)]/50 font-mono text-xs"
                >
                  <td className="px-4 py-3 text-[var(--ink-tertiary)] whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${levelColors[log.level] || "text-[var(--ink-tertiary)]"}`}
                  >
                    {log.level}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-secondary)]">{log.action}</td>
                  <td className="px-4 py-3 text-[var(--ink-tertiary)] max-w-md truncate">
                    {log.message}
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
