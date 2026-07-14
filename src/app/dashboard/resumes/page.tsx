import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMasterResume, getTailoredResumes } from "@/lib/data/dashboard";
import { Download, FileText } from "lucide-react";
import { ResumeUploadForm } from "@/components/dashboard/resume-upload";
import { MasterResumeCard } from "@/components/dashboard/master-resume-card";
import { Button } from "@/components/ui/button";

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
              <MasterResumeCard
                title={masterResume.title}
                rawText={masterResume.rawText}
                skills={masterResume.skills}
              />
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
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <a href={`/api/resumes/${resume.id}/pdf`}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download PDF
                      </a>
                    </Button>
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
