import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { getAuditLogs } from "@/lib/data/dashboard";
import { ScrollText } from "lucide-react";
import { formatDate } from "@/lib/utils";

const levelColors: Record<string, string> = {
  DEBUG: "text-zinc-500",
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
  AUDIT: "text-violet-400",
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
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-zinc-800/50 font-mono text-xs"
                >
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${levelColors[log.level] || "text-zinc-400"}`}
                  >
                    {log.level}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{log.action}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-md truncate">
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
