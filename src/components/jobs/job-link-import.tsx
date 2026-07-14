"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImportedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string;
  matchScore: number | null;
  matchAnalysis: {
    strengths?: string[];
    gaps?: string[];
    recommendation?: string;
  } | null;
}

interface ImportResponse {
  duplicate?: boolean;
  job?: ImportedJob;
  analysisError?: string;
  error?: string;
  code?: string;
  retryable?: boolean;
  needsManualDescription?: boolean;
}

export function JobLinkImportButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [open, loading]);

  const submit = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/jobs/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          manual: manual
            ? {
                title,
                company,
                location: location || undefined,
                description,
              }
            : undefined,
        }),
      });
      const data = (await response.json()) as ImportResponse;
      setResult(data);
      if (response.ok) {
        router.refresh();
      } else if (data.needsManualDescription) {
        setManual(true);
      }
    } catch {
      setResult({
        error: "The connection was interrupted. Your job was not marked as imported.",
        code: "NETWORK_ERROR",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setManual(false);
    setTitle("");
    setCompany("");
    setLocation("");
    setDescription("");
  };

  const askKairela = () => {
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("kairela:open", {
        detail: {
          prompt: result?.job
            ? `Help me apply to ${result.job.title} at ${result.job.company}.`
            : `Help me import this job link: ${url}`,
        },
      })
    );
  };

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "default"}
        size={compact ? "sm" : "default"}
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <Link2 className="h-4 w-4" />
        {compact ? "Paste link" : "Paste a job link"}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !loading) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-[var(--radius-lg)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-[var(--ink)]">
                  Paste a job link
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                  Kairela will verify the public page, extract the role, and compare it with your profile.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close job link importer"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-sunken)] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!result?.job && (
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${titleId}-url`}>Public job URL</Label>
                  <Input
                    id={`${titleId}-url`}
                    type="url"
                    inputMode="url"
                    autoFocus
                    value={url}
                    disabled={loading}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://company.com/careers/job"
                    className="h-11"
                  />
                </div>

                {manual && (
                  <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--ink)]">Add the job details manually</p>
                      <p className="text-xs text-[var(--ink-tertiary)]">
                        Use this when the page requires login or blocks automated access.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`${titleId}-role`}>Role</Label>
                        <Input
                          id={`${titleId}-role`}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${titleId}-company`}>Company</Label>
                        <Input
                          id={`${titleId}-company`}
                          value={company}
                          onChange={(event) => setCompany(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${titleId}-location`}>Location (optional)</Label>
                      <Input
                        id={`${titleId}-location`}
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Pune, India or Remote"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${titleId}-description`}>Job description</Label>
                      <textarea
                        id={`${titleId}-description`}
                        value={description}
                        disabled={loading}
                        onChange={(event) => setDescription(event.target.value)}
                        className="min-h-40 w-full rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        placeholder="Paste the complete job description…"
                      />
                      <p className="text-xs text-[var(--ink-tertiary)]">
                        {description.trim().length}/80 minimum characters
                      </p>
                    </div>
                  </div>
                )}

                {result?.error && (
                  <div
                    role="alert"
                    className="rounded-[var(--radius-sm)] border border-[var(--error)]/30 bg-[var(--error-muted)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--ink)]">Import did not finish</p>
                    <p className="mt-1 text-sm text-[var(--ink-secondary)]">{result.error}</p>
                    <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                      No successful extraction was recorded.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={submit}
                    disabled={
                      loading ||
                      !url.trim() ||
                      (manual &&
                        (!title.trim() ||
                          !company.trim() ||
                          description.trim().length < 80))
                    }
                    className="h-11 gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying job…
                      </>
                    ) : manual ? (
                      "Import manual details"
                    ) : (
                      "Import and compare"
                    )}
                  </Button>
                  {!manual && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => setManual(true)}
                    >
                      Paste description instead
                    </Button>
                  )}
                  {result?.retryable && (
                    <Button type="button" variant="ghost" className="h-11 gap-2" onClick={submit}>
                      <RotateCcw className="h-4 w-4" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )}

            {result?.job && (
              <div className="mt-5 space-y-4">
                <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-sunken)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--success)]">
                        <CheckCircle2 className="h-4 w-4" />
                        {result.duplicate ? "Already in your jobs" : "Job imported"}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-[var(--ink)]">{result.job.title}</h3>
                      <p className="text-sm text-[var(--ink-secondary)]">
                        {result.job.company}
                        {result.job.location ? ` · ${result.job.location}` : ""}
                      </p>
                    </div>
                    {result.job.matchScore != null && (
                      <div className="rounded-full bg-[var(--accent-muted)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                        {Math.round(result.job.matchScore)}% match
                      </div>
                    )}
                  </div>

                  {result.job.matchAnalysis?.strengths?.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-[var(--ink)]">Strengths</p>
                      <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                        {result.job.matchAnalysis.strengths.slice(0, 3).join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  {result.job.matchAnalysis?.gaps?.length ? (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-[var(--ink)]">Gaps to review</p>
                      <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                        {result.job.matchAnalysis.gaps.slice(0, 3).join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  {result.analysisError && (
                    <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
                      Saved successfully. Match analysis needs attention: {result.analysisError}
                    </p>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/dashboard/applications" onClick={() => setOpen(false)}>
                    <Button type="button" className="h-11 w-full gap-2">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Prepare application
                    </Button>
                  </Link>
                  <Button type="button" variant="outline" className="h-11 gap-2" onClick={askKairela}>
                    <MessageCircle className="h-4 w-4" />
                    Ask Kairela
                  </Button>
                  <Link href="/dashboard/resumes" onClick={() => setOpen(false)}>
                    <Button type="button" variant="outline" className="h-11 w-full">
                      Tailor resume
                    </Button>
                  </Link>
                  <a href={result.job.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="ghost" className="h-11 w-full gap-2">
                      View original
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>

                <Button type="button" variant="ghost" onClick={reset} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Import another link
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
