import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { getEmails } from "@/lib/data/dashboard";
import { Inbox } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default async function InboxPage() {
  const emails = await getEmails();

  return (
    <div>
      <DashboardHeader
        title="Recruiter Inbox"
        description="Emails from recruiters and hiring managers"
      />

      {emails.length === 0 ? (
        <EmptyState
          title="No emails yet"
          description="Connect Gmail in Settings to sync recruiter communications."
          icon={<Inbox className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <Card
              key={email.id}
              className={!email.isRead ? "border-violet-500/30" : ""}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div
                  className={`mt-1 h-2 w-2 rounded-full ${!email.isRead ? "bg-violet-500" : "bg-transparent"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-zinc-200 truncate">
                      {email.subject}
                    </p>
                    <span className="text-xs text-zinc-500 shrink-0 ml-4">
                      {formatRelativeTime(email.receivedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {email.direction === "INBOUND" ? "From" : "To"}:{" "}
                    {email.direction === "INBOUND"
                      ? email.fromAddress
                      : email.toAddress}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
                    {email.body}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
