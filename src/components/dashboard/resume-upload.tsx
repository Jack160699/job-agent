"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function ResumeUploadForm() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("Master Resume");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Please paste your resume content");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/resumes/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, rawText: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Resume uploaded successfully");
      window.location.reload();
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
        <Label htmlFor="content">Resume Content</Label>
        <textarea
          id="content"
          className="flex min-h-[200px] w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          placeholder="Paste your full resume text here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="gap-2">
        <Upload className="h-4 w-4" />
        {loading ? "Uploading..." : "Upload Resume"}
      </Button>
    </form>
  );
}
