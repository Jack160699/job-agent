import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState, StatusBadge } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { getInterviews } from "@/lib/data/dashboard";
import { Calendar, MapPin, Video } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function CalendarPage() {
  const interviews = await getInterviews();
  const upcoming = interviews.filter(
    (i) => new Date(i.scheduledAt) >= new Date()
  );
  const past = interviews.filter(
    (i) => new Date(i.scheduledAt) < new Date()
  );

  return (
    <div>
      <DashboardHeader
        title="Interview Calendar"
        description="Upcoming and past interviews"
      />

      {interviews.length === 0 ? (
        <EmptyState
          title="No interviews scheduled"
          description="Interviews will appear here when synced from Google Calendar or added manually."
          icon={<Calendar className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">Past</h2>
              <div className="space-y-3 opacity-60">
                {past.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewCard({
  interview,
}: {
  interview: {
    id: string;
    title: string;
    company: string | null;
    status: string;
    scheduledAt: Date;
    durationMin: number;
    location: string | null;
    meetingUrl: string | null;
  };
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="font-medium text-[var(--ink)]">{interview.title}</p>
          {interview.company && (
            <p className="text-sm text-[var(--ink-tertiary)]">{interview.company}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-xs text-[var(--ink-tertiary)]">
            <span>{formatDate(interview.scheduledAt)}</span>
            <span>{interview.durationMin} min</span>
            {interview.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {interview.location}
              </span>
            )}
            {interview.meetingUrl && (
              <a
                href={interview.meetingUrl}
                className="flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                <Video className="h-3 w-3" />
                Join
              </a>
            )}
          </div>
        </div>
        <StatusBadge status={interview.status} />
      </CardContent>
    </Card>
  );
}
