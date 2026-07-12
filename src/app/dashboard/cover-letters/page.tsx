import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { getCoverLetters } from "@/lib/data/dashboard";
import { Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function CoverLettersPage() {
  const coverLetters = await getCoverLetters();

  return (
    <div>
      <DashboardHeader
        title="Cover Letter Manager"
        description="AI-generated cover letters for your applications"
      />

      {coverLetters.length === 0 ? (
        <EmptyState
          title="No cover letters yet"
          description="Cover letters are automatically generated when processing matched job applications."
          icon={<Mail className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {coverLetters.map((letter) => (
            <Card key={letter.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--ink)]">
                      {letter.title}
                    </h3>
                    {letter.job && (
                      <p className="text-sm text-[var(--ink-tertiary)]">
                        {letter.job.company} — {letter.job.title}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                      {formatDate(letter.createdAt)} · {letter.tone} tone
                    </p>
                  </div>
                </div>
                <div className="mt-4 whitespace-pre-wrap text-sm text-[var(--ink-secondary)]">
                  {letter.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
