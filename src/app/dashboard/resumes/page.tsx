import { DashboardHeader } from "@/components/dashboard/sidebar";
import { EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResumeHistory } from "@/lib/data/dashboard";
import { Download, FileText } from "lucide-react";
import { ResumeUploadForm } from "@/components/dashboard/resume-upload";
import { MasterResumeCard } from "@/components/dashboard/master-resume-card";
import { Button } from "@/components/ui/button";
import {
  ResumeHistory,
  type ResumeHistoryEntry,
} from "@/components/dashboard/resume-history";

export default async function ResumesPage() {
  const history = await getResumeHistory();
  const masterResume = history.master;
  const tailoredResumes = history.tailored;
  const historyEntries: ResumeHistoryEntry[] = [];

  if (masterResume) {
    historyEntries.push({
      key: `master-current-${masterResume.id}`,
      id: masterResume.id,
      documentType: "MASTER",
      isCurrent: true,
      version: masterResume.version,
      title: masterResume.title,
      rawText: masterResume.rawText,
      createdAt: masterResume.updatedAt.toISOString(),
      status: "CURRENT",
      downloadUrl: "/api/resumes/master/pdf",
    });
  }
  for (const version of history.masterVersions) {
    historyEntries.push({
      key: `master-version-${version.id}`,
      id: version.id,
      documentType: "MASTER",
      isCurrent: false,
      version: version.version,
      title: version.title,
      rawText: version.rawText,
      createdAt: version.createdAt.toISOString(),
      status: "VERSION",
      downloadUrl: `/api/resumes/master/pdf?versionId=${version.id}`,
    });
  }
  for (const resume of tailoredResumes) {
    const source = resume.sourceMasterSnapshot as {
      title?: string;
      version?: number;
      rawText?: string;
    } | null;
    const grounding = resume.groundingReport as ResumeHistoryEntry["groundingReport"];
    historyEntries.push({
      key: `tailored-current-${resume.id}`,
      id: resume.id,
      documentType: "TAILORED",
      isCurrent: true,
      version: resume.version,
      title: resume.title,
      rawText: resume.rawText,
      createdAt: resume.updatedAt.toISOString(),
      status: resume.archivedAt ? "ARCHIVED" : "CURRENT",
      job: resume.job,
      application: resume.application,
      sourceMaster: {
        title: resume.sourceMasterTitle ?? source?.title ?? null,
        version: resume.sourceMasterVersion ?? source?.version ?? null,
        removed: resume.masterResumeId == null,
        rawText: source?.rawText ?? null,
      },
      groundingReport: grounding,
      downloadUrl: `/api/resumes/${resume.id}/pdf`,
    });
    for (const version of resume.versions) {
      const versionSource = version.sourceMasterSnapshot as {
        title?: string;
        version?: number;
        rawText?: string;
      } | null;
      historyEntries.push({
        key: `tailored-version-${version.id}`,
        id: version.id,
        parentId: resume.id,
        documentType: "TAILORED",
        isCurrent: false,
        version: version.version,
        title: version.title,
        rawText: version.rawText,
        createdAt: version.createdAt.toISOString(),
        status: "VERSION",
        job: resume.job,
        application: resume.application,
        sourceMaster: {
          title: version.sourceMasterTitle ?? versionSource?.title ?? null,
          version:
            version.sourceMasterVersion ?? versionSource?.version ?? null,
          removed: resume.masterResumeId == null,
          rawText: versionSource?.rawText ?? null,
        },
        groundingReport:
          version.groundingReport as ResumeHistoryEntry["groundingReport"],
        downloadUrl: `/api/resumes/${resume.id}/pdf?versionId=${version.id}`,
      });
    }
  }

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
      <ResumeHistory entries={historyEntries} initialError={history.error} />
    </div>
  );
}
