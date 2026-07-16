"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, RotateCcw, X } from "lucide-react";
import { trackOnboardingEvent } from "@/lib/analytics/events";
import {
  ACCEPTED_RESUME_ACCEPT_ATTR,
  MAX_RESUME_FILE_BYTES,
  type MasterResumeUploadResult,
  type UploadStatus,
} from "./types";

interface ResumeEntryScreenProps {
  onUploaded: (result: MasterResumeUploadResult) => void;
  onSkip: () => void | Promise<void>;
  skipping: boolean;
}

function extensionOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

export function ResumeEntryScreen({ onUploaded, onSkip, skipping }: ResumeEntryScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");

  useEffect(() => {
    trackOnboardingEvent("onboarding_resume_screen_viewed");
  }, []);

  const upload = useCallback(
    async (body: FormData | string, meta: { fileType?: string }) => {
      setStatus("uploading");
      setErrorMessage(null);
      trackOnboardingEvent("onboarding_resume_upload_started", { fileType: meta.fileType });
      try {
        const res = await fetch("/api/resumes/master", {
          method: "POST",
          headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
          body,
        });
        setStatus("processing");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "We couldn't process that resume.");
        setStatus("success");
        trackOnboardingEvent("onboarding_resume_upload_succeeded", {
          fileType: meta.fileType,
          skillsCount: data.profile?.skills?.value?.length ?? 0,
        });
        onUploaded({
          id: data.id,
          title: data.title,
          version: data.version,
          profile: data.profile,
          atsScore: data.atsScore,
          enrichmentPending: Boolean(data.enrichmentPending),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        setStatus("error");
        setErrorMessage(message);
        trackOnboardingEvent("onboarding_resume_upload_failed", {
          fileType: meta.fileType,
          errorCategory: message.slice(0, 60),
        });
      }
    },
    [onUploaded]
  );

  const handleFile = useCallback(
    (selected: File) => {
      const ext = extensionOf(selected.name);
      if (ext === "doc") {
        setFile(null);
        setStatus("error");
        setErrorMessage(
          "We can't read legacy .doc files yet. Please save or export this resume as PDF or DOCX and try again."
        );
        return;
      }
      if (!["pdf", "docx", "txt"].includes(ext)) {
        setFile(null);
        setStatus("error");
        setErrorMessage("Upload a PDF, DOCX, or TXT resume.");
        return;
      }
      if (selected.size > MAX_RESUME_FILE_BYTES) {
        setFile(null);
        setStatus("error");
        setErrorMessage("Resume files must be 5 MB or smaller.");
        return;
      }
      setFile(selected);
      const form = new FormData();
      form.set("title", "Master Resume");
      form.set("file", selected);
      void upload(form, { fileType: ext });
    },
    [upload]
  );

  const retry = useCallback(() => {
    if (!file) return;
    const form = new FormData();
    form.set("title", "Master Resume");
    form.set("file", file);
    void upload(form, { fileType: extensionOf(file.name) });
  }, [file, upload]);

  const clearFile = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const busy = status === "uploading" || status === "processing";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--rf-ink)]">Start with your resume</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--rf-ink-secondary)]">
          Upload your resume and Kairela will prepare most of your career profile for you. You
          can review and edit everything before continuing.
        </p>
      </div>

      {!pasteMode && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload your resume: PDF, DOCX, or TXT, up to 5 MB. Drag and drop or activate to browse files."
          data-testid="resume-dropzone"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={busy ? undefined : onDrop}
          className={[
            "flex min-h-[168px] w-full flex-col items-center justify-center gap-3 rounded-[var(--rf-radius)] border-2 border-dashed p-6 text-center transition-colors",
            dragActive
              ? "border-[var(--rf-primary)] bg-[var(--rf-primary-muted)]"
              : "border-[var(--rf-line-strong)] bg-[var(--rf-surface)]",
            busy ? "cursor-wait opacity-80" : "cursor-pointer",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            id="resume-file-input"
            type="file"
            className="sr-only"
            accept={ACCEPTED_RESUME_ACCEPT_ATTR}
            aria-label="Choose a resume file to upload"
            disabled={busy}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFile(selected);
            }}
          />
          <UploadCloud className="h-8 w-8 text-[var(--rf-primary)]" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--rf-ink)]">
              {file ? file.name : "Drag and drop your resume, or tap to browse"}
            </p>
            <p className="text-xs text-[var(--rf-ink-tertiary)]">
              PDF, DOCX, or TXT — up to 5 MB
            </p>
          </div>
        </div>
      )}

      {pasteMode && (
        <div className="space-y-2">
          <label htmlFor="resume-paste" className="text-sm font-medium text-[var(--rf-ink)]">
            Paste your resume text
          </label>
          <textarea
            id="resume-paste"
            className="min-h-[160px] w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-[var(--rf-bg)] p-3 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={busy}
          />
          <Button
            type="button"
            className="h-11 w-full bg-[var(--rf-primary)] hover:bg-[var(--rf-primary-hover)]"
            disabled={busy || pastedText.trim().length < 80}
            onClick={() => void upload(JSON.stringify({ title: "Master Resume", rawText: pastedText }), { fileType: "pasted-text" })}
          >
            {busy ? "Processing…" : "Extract details from pasted text"}
          </Button>
        </div>
      )}

      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {status === "uploading" && (
          <p className="flex items-center gap-2 text-[var(--rf-primary)]">
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--rf-primary)] border-t-transparent"
              aria-hidden="true"
            />
            Uploading your resume…
          </p>
        )}
        {status === "processing" && (
          <p className="flex items-center gap-2 text-[var(--rf-primary)]">
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--rf-primary)] border-t-transparent"
              aria-hidden="true"
            />
            Reading your career history…
          </p>
        )}
        {status === "success" && (
          <p className="flex items-center gap-2 text-[var(--rf-success)]">
            <FileText className="h-4 w-4" aria-hidden="true" /> Resume processed. Loading your review…
          </p>
        )}
        {status === "error" && errorMessage && (
          <div className="space-y-2 rounded-[var(--rf-radius-sm)] border border-[color:#f3c6c6] bg-[#fdf1f1] p-3 text-[#8a2323]">
            <p>{errorMessage}</p>
            <div className="flex flex-wrap gap-2">
              {file && (
                <Button type="button" size="sm" variant="outline" className="h-9 gap-1" onClick={retry}>
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
              {file && (
                <Button type="button" size="sm" variant="ghost" className="h-9 gap-1" onClick={clearFile}>
                  <X className="h-3.5 w-3.5" /> Choose a different file
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-[var(--rf-ink-secondary)]"
          onClick={() => setPasteMode((v) => !v)}
          disabled={busy}
        >
          {pasteMode ? "Upload a file instead" : "Or paste your resume text"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 border-[var(--rf-line-strong)] text-[var(--rf-ink-secondary)]"
          disabled={skipping || busy}
          onClick={() => {
            trackOnboardingEvent("onboarding_resume_skipped");
            void onSkip();
          }}
        >
          {skipping ? "Continuing…" : "Continue without a resume"}
        </Button>
      </div>
    </div>
  );
}
