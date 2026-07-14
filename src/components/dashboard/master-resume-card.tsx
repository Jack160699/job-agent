"use client";

import { useState } from "react";
import { History, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResumeUploadForm } from "@/components/dashboard/resume-upload";
import { toast } from "sonner";

export function MasterResumeCard({
  title,
  rawText,
  skills,
}: {
  title: string;
  rawText: string;
  skills: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [versions, setVersions] = useState<
    Array<{
      id: string;
      version: number;
      title: string;
      createdAt: string;
      rawText: string;
    }>
  >([]);
  const [showVersions, setShowVersions] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const remove = async () => {
    if (
      !window.confirm(
        "Delete your master resume? Existing tailored documents remain, but new tailoring will be unavailable until you add another resume."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch("/api/resumes/master", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed");
      toast.success("Master resume deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const toggleVersions = async () => {
    const next = !showVersions;
    setShowVersions(next);
    if (!next || versions.length > 0) return;
    try {
      const response = await fetch("/api/resumes/master/versions");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "History failed to load");
      setVersions(data.versions ?? []);
    } catch (error) {
      setShowVersions(false);
      toast.error(error instanceof Error ? error.message : "History failed to load");
    }
  };

  const restore = async (versionId: string) => {
    if (!window.confirm("Restore this version as your current master resume?")) {
      return;
    }
    setRestoring(versionId);
    try {
      const response = await fetch("/api/resumes/master/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restore failed");
      toast.success("Resume version restored");
      setVersions([]);
      setShowVersions(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setRestoring(null);
    }
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <ResumeUploadForm
          initialTitle={title}
          initialContent={rawText}
          onSaved={() => setEditing(false)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void toggleVersions()}
        >
          <History className="mr-1 h-3.5 w-3.5" />
          History
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
        >
          Cancel editing
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      <p className="mt-2 line-clamp-6 text-sm text-[var(--ink-tertiary)]">
        {rawText}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs text-[var(--accent)]"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit or replace
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={deleting}
          onClick={() => void remove()}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
      {showVersions && (
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium">Previous versions</p>
          {versions.length === 0 ? (
            <p className="text-xs text-[var(--ink-tertiary)]">
              No previous versions yet.
            </p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    Version {version.version} · {version.title}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-tertiary)]">
                    {version.rawText}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={restoring === version.id}
                  onClick={() => void restore(version.id)}
                >
                  {restoring === version.id ? "Restoring…" : "Restore"}
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
