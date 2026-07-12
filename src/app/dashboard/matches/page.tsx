import { DashboardHeader } from "@/components/dashboard/sidebar";
import { MatchScoreBadge, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getJobs } from "@/lib/data/dashboard";
import { Target } from "lucide-react";

export default async function MatchesPage() {
  const jobs = await getJobs({ minScore: 50 });
  const sorted = [...jobs].sort(
    (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)
  );

  return (
    <div>
      <DashboardHeader
        title="AI Match Scores"
        description="Jobs ranked by relevance to your profile"
      />

      {sorted.length === 0 ? (
        <EmptyState
          title="No matches yet"
          description="Upload your master resume and run job analysis to see match scores."
          icon={<Target className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {sorted.map((job) => {
            const analysis = job.matchAnalysis as {
              skillMatch?: number;
              experienceMatch?: number;
              strengths?: string[];
              gaps?: string[];
              reasoning?: string;
            } | null;

            return (
              <Card key={job.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-100">
                        {job.title}
                      </h3>
                      <p className="text-sm text-zinc-400">{job.company}</p>
                    </div>
                    {job.matchScore != null && (
                      <MatchScoreBadge score={job.matchScore} size="lg" />
                    )}
                  </div>

                  {analysis && (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-zinc-400">
                          <span>Skill Match</span>
                          <span>{analysis.skillMatch ?? 0}%</span>
                        </div>
                        <Progress value={analysis.skillMatch ?? 0} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-zinc-400">
                          <span>Experience Match</span>
                          <span>{analysis.experienceMatch ?? 0}%</span>
                        </div>
                        <Progress value={analysis.experienceMatch ?? 0} />
                      </div>
                    </div>
                  )}

                  {analysis?.strengths && analysis.strengths.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-emerald-400">
                        Strengths
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {analysis.strengths.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis?.gaps && analysis.gaps.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-amber-400">Gaps</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {analysis.gaps.map((g) => (
                          <span
                            key={g}
                            className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis?.reasoning && (
                    <p className="mt-4 text-sm text-zinc-500">
                      {analysis.reasoning}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
