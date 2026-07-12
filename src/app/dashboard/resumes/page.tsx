import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMasterResume, getTailoredResumes } from "@/lib/data/dashboard";
import { FileText } from "lucide-react";
import { ResumeUploadForm } from "@/components/dashboard/resume-upload";

export default async function ResumesPage() {
  const [masterResume, tailoredResumes] = await Promise.all([
    getMasterResume(),
    getTailoredResumes(),
  ]);

  return (
    <div>
      <DashboardHeader
        title="Resume Manager"
        description="Master resume and AI-tailored versions"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Master Resume</CardTitle>
          </CardHeader>
          <CardContent>
            {masterResume ? (
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  {masterResume.title}
                </p>
                <p className="mt-2 text-sm text-[var(--ink-tertiary)] line-clamp-6">
                  {masterResume.rawText}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {masterResume.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs text-[var(--accent)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <ResumeUploadForm />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tailored Resumes ({tailoredResumes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tailoredResumes.length === 0 ? (
              <EmptyState
                title="No tailored resumes"
                description="Tailored resumes are generated when you process matched jobs."
                icon={<FileText className="h-6 w-6" />}
              />
            ) : (
              <div className="space-y-4">
                {tailoredResumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="rounded-lg border border-[var(--line)] p-4"
                  >
                    <p className="font-medium text-[var(--ink)]">{resume.title}</p>
                    {resume.job && (
                      <p className="text-sm text-[var(--ink-tertiary)]">
                        For: {resume.job.title} at {resume.job.company}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-[var(--ink-tertiary)] line-clamp-3">
                      {resume.rawText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
