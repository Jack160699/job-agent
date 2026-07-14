"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export function ResumeUploadForm({
  initialTitle = "Master Resume",
  initialContent = "",
  onSaved,
}: {
  initialTitle?: string;
  initialContent?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !content.trim()) {
      toast.error("Choose a resume file or paste your resume content");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Resume files must be 5 MB or smaller");
      return;
    }

    setLoading(true);
    try {
      const body = file
        ? (() => {
            const form = new FormData();
            form.set("title", title);
            form.set("file", file);
            return form;
          })()
        : JSON.stringify({ title, rawText: content });
      const res = await fetch("/api/resumes/master", {
        method: "POST",
        headers: file ? undefined : { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Resume uploaded successfully");
      setContent("");
      setFile(null);
      router.refresh();
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Resume Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="resume-file">Upload PDF, DOCX, or text</Label>
        <Input
          id="resume-file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-[var(--ink-tertiary)]">
          Maximum 5 MB. Scanned PDFs need text recognition before upload.
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-[var(--ink-tertiary)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or paste text
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Resume Content</Label>
        <textarea
          id="content"
          className="flex min-h-[200px] w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          placeholder="Paste your full resume text here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={Boolean(file)}
        />
      </div>
      <Button type="submit" disabled={loading} className="gap-2">
        <Upload className="h-4 w-4" />
        {loading
          ? "Processing…"
          : file
            ? "Upload and parse resume"
            : "Save resume"}
      </Button>
    </form>
  );
}
