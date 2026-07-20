"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Download,
  Eye,
  GitCompareArrows,
  History,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { REMOVED_MASTER_LABEL } from "@/lib/resumes/history-policy";
import { formatIndiaDateTime } from "@/lib/utils";
import { SafeFixReviewPanel } from "./safe-fix-review-panel";

export type ResumeHistoryEntry = {
  key: string;
  id: string;
  parentId?: string;
  documentType: "MASTER" | "TAILORED";
  isCurrent: boolean;
  version: number;
  title: string;
  rawText: string;
  createdAt: string;
  status: "CURRENT" | "ARCHIVED" | "VERSION";
  job?: { id: string; title: string; company: string } | null;
  application?: { id: string; status: string } | null;
  sourceMaster?: {
    title: string | null;
    version: number | null;
    removed: boolean;
    rawText?: string | null;
  };
  groundingReport?: {
    version?: string;
    acceptedCount?: number;
    gaps?: string[];
    claims?: Array<{
      category?: string;
      claim?: string;
      sourceResume?: string;
      sourceSection?: string;
      sourceExcerpt?: string | null;
      state?: "SOURCE_CONFIRMED" | "AI_REWORDED" | "UNSUPPORTED";
      userConfirmed?: boolean;
      aiImproved?: boolean;
      reviewRequired?: boolean;
    }>;
    excluded?: Array<{
      category?: string;
      claim?: string;
      reasonCode?: string;
    }>;
  } | null;
  downloadUrl: string;
};

function lineDiff(left: string, right: string) {
  const before = left.split("\n").map((line) => line.trim()).filter(Boolean);
  const after = right.split("\n").map((line) => line.trim()).filter(Boolean);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((line) => !beforeSet.has(line));
  const removed = before.filter((line) => !afterSet.has(line));
  return {
    added,
    removed,
    rewritten: removed
      .slice(0, Math.min(removed.length, added.length))
      .map((line, index) => `${line} → ${added[index]}`),
    unchanged: after.filter((line) => beforeSet.has(line)),
  };
}

export function ResumeHistory({
  entries,
  initialError,
}: {
  entries: ResumeHistoryEntry[];
  initialError?: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<"ALL" | "MASTER" | "TAILORED">("ALL");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        if (type !== "ALL" && entry.documentType !== type) return false;
        if (date && !entry.createdAt.startsWith(date)) return false;
        const text = `${entry.title} ${entry.job?.title ?? ""} ${
          entry.job?.company ?? ""
        }`.toLowerCase();
        return text.includes(query.trim().toLowerCase());
      }),
    [date, entries, query, type]
  );
  const opened = entries.find((entry) => entry.key === openKey) ?? null;
  const compared = selected
    .map((key) => entries.find((entry) => entry.key === key))
    .filter((entry): entry is ResumeHistoryEntry => Boolean(entry));
  const comparison =
    compared.length === 2
      ? lineDiff(compared[0].rawText, compared[1].rawText)
      : null;
  const sourceComparison =
    opened?.sourceMaster?.rawText
      ? lineDiff(opened.sourceMaster.rawText, opened.rawText)
      : null;

  const request = async (
    key: string,
    url: string,
    init: RequestInit,
    success: string
  ) => {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      toast.success(success);
      router.refresh();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Action failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const rename = async (entry: ResumeHistoryEntry) => {
    const title = window.prompt("Resume name", entry.title)?.trim();
    if (!title || title === entry.title) return;
    await request(
      entry.key,
      `/api/resumes/${entry.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", title }),
      },
      "Resume renamed"
    );
  };

  const archive = async (entry: ResumeHistoryEntry) => {
    const action = entry.status === "ARCHIVED" ? "unarchive" : "archive";
    await request(
      entry.key,
      `/api/resumes/${entry.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
      action === "archive" ? "Resume archived" : "Resume restored"
    );
  };

  const remove = async (entry: ResumeHistoryEntry) => {
    if (
      !window.confirm(
        "Delete this tailored resume and its version history? Applications requiring preservation will block deletion."
      )
    ) {
      return;
    }
    await request(
      entry.key,
      `/api/resumes/${entry.id}`,
      { method: "DELETE" },
      "Resume deleted"
    );
  };

  const restoreVersion = async (entry: ResumeHistoryEntry) => {
    if (!window.confirm(`Restore version ${entry.version} as current?`)) return;
    const isMaster = entry.documentType === "MASTER";
    await request(
      entry.key,
      isMaster
        ? "/api/resumes/master/versions"
        : `/api/resumes/${entry.parentId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: entry.id }),
      },
      "Version restored"
    );
  };

  return (
    <section className="mt-8 space-y-4" aria-labelledby="resume-history-title">
      <div>
        <h2
          id="resume-history-title"
          className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]"
        >
          <History className="h-5 w-5" />
          Resume History
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-tertiary)]">
          Review durable document versions, grounding decisions, and application use.
          DOCX export is not currently supported; PDF exports use authorized document IDs.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as "ALL" | "MASTER" | "TAILORED")
          }
          className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          aria-label="Filter document type"
        >
          <option value="ALL">All documents</option>
          <option value="MASTER">Master resumes</option>
          <option value="TAILORED">Tailored resumes</option>
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by title, job, or company"
          className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
        />
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          aria-label="Filter creation date"
        />
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-[var(--error)]/30 bg-[var(--error-muted)] p-3 text-sm">
          <span>{error}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setError(null);
              router.refresh();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--ink-tertiary)]">
          No resume history matches these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <article
              key={entry.key}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(entry.key)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(entry.key)
                            ? current.filter((key) => key !== entry.key)
                            : current.length < 2
                              ? [...current, entry.key]
                              : [current[1], entry.key]
                        )
                      }
                      aria-label={`Select ${entry.title} for comparison`}
                    />
                    <h3 className="truncate font-medium text-[var(--ink)]">
                      {entry.title}
                    </h3>
                    <span className="rounded bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-medium">
                      {entry.documentType} · v{entry.version}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--ink-tertiary)]">
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                    Created {formatIndiaDateTime(entry.createdAt)}
                  </p>
                  {entry.job && (
                    <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                      {entry.job.title} at {entry.job.company}
                    </p>
                  )}
                  {entry.sourceMaster && (
                    <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                      Based on {entry.sourceMaster.title ?? "Master Resume"} version{" "}
                      {entry.sourceMaster.version ?? "unknown"}
                      {entry.sourceMaster.removed && (
                        <span className="ml-2 font-medium text-[var(--warning)]">
                          {REMOVED_MASTER_LABEL}
                        </span>
                      )}
                    </p>
                  )}
                  {entry.groundingReport?.excluded?.length ? (
                    <p className="mt-2 text-xs text-[var(--warning)]">
                      {entry.groundingReport.excluded.length} proposed change(s)
                      excluded by grounding.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setOpenKey(entry.key)}
                  >
                    <Eye className="h-3 w-3" /> Open
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <a href={entry.downloadUrl}>
                      <Download className="h-3 w-3" /> PDF
                    </a>
                  </Button>
                  {!entry.isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={busy === entry.key}
                      onClick={() => void restoreVersion(entry)}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                  )}
                  {entry.isCurrent && entry.documentType === "TAILORED" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        disabled={busy === entry.key}
                        onClick={() => void rename(entry)}
                      >
                        <Pencil className="h-3 w-3" /> Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        disabled={busy === entry.key}
                        onClick={() => void archive(entry)}
                      >
                        <Archive className="h-3 w-3" />
                        {entry.status === "ARCHIVED" ? "Unarchive" : "Archive"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        disabled={busy === entry.key}
                        onClick={() => void remove(entry)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </>
                  )}
                  {entry.application && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/dashboard/applications?focus=${entry.application.id}`}>
                        Application
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {comparison && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          <h3 className="flex items-center gap-2 font-medium">
            <GitCompareArrows className="h-4 w-4" />
            Version comparison
          </h3>
          <DiffColumns
            added={comparison.added}
            removed={comparison.removed}
            rewritten={comparison.rewritten}
            unchanged={comparison.unchanged}
          />
        </div>
      )}

      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`${opened.title} details`}
        >
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl bg-[var(--surface)] p-5 sm:max-w-3xl sm:rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{opened.title}</h3>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  {opened.documentType} · version {opened.version}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpenKey(null)}
                aria-label="Close resume details"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-[var(--surface-sunken)] p-4 text-xs text-[var(--ink-secondary)]">
              {opened.rawText}
            </pre>
            {sourceComparison && (
              <div className="mt-5">
                <h4 className="font-medium">Changes from source master</h4>
                <DiffColumns
                  added={sourceComparison.added}
                  removed={sourceComparison.removed}
                  rewritten={sourceComparison.rewritten}
                  unchanged={sourceComparison.unchanged}
                />
              </div>
            )}
            {opened.groundingReport && (
              <div className="mt-5">
                <h4 className="font-medium">Grounding review</h4>
                <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  Accepted checks: {opened.groundingReport.acceptedCount ?? 0}
                </p>
                {opened.groundingReport.gaps?.length ? (
                  <p className="mt-2 text-xs">
                    Missing requirements: {opened.groundingReport.gaps.join(", ")}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1 text-xs text-[var(--warning)]">
                  {opened.groundingReport.excluded?.map((item, index) => (
                    <li key={`${item.reasonCode}-${index}`}>
                      Rejected {item.category}: {item.claim} ({item.reasonCode})
                    </li>
                  ))}
                </ul>
                {(opened.groundingReport.claims?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="text-sm font-medium">
                      Claim-to-source inspector
                    </h5>
                    {opened.groundingReport.claims?.map((claim, index) => (
                      <article
                        key={`${claim.category}-${claim.claim}-${index}`}
                        className="rounded-md border border-[var(--line)] p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--ink)]">
                            {claim.claim}
                          </span>
                          <span className="rounded bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px]">
                            {claim.state === "SOURCE_CONFIRMED"
                              ? "Source confirmed"
                              : claim.state === "AI_REWORDED"
                                ? "AI-improved wording · review required"
                                : "Unsupported · excluded"}
                          </span>
                        </div>
                        <p className="mt-1 text-[var(--ink-tertiary)]">
                          Source: {claim.sourceResume ?? "Master Resume"} ·{" "}
                          {claim.sourceSection ?? claim.category ?? "Resume"}
                        </p>
                        {claim.sourceExcerpt && (
                          <blockquote className="mt-2 border-l-2 border-[var(--line-strong)] pl-2 text-[var(--ink-secondary)]">
                            {claim.sourceExcerpt}
                          </blockquote>
                        )}
                        <p className="mt-2 text-[var(--ink-tertiary)]">
                          User confirmed: {claim.userConfirmed ? "Yes" : "Not yet"} ·
                          AI wording: {claim.aiImproved ? "Yes" : "No"} · Review:{" "}
                          {claim.reviewRequired ? "Required" : "Not required"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
            {opened.documentType === "TAILORED" && opened.isCurrent && (
              <SafeFixReviewPanel resumeId={opened.id} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DiffColumns({
  added,
  removed,
  rewritten,
  unchanged,
}: {
  added: string[];
  removed: string[];
  rewritten: string[];
  unchanged: string[];
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <DiffList title="Added content" values={added} className="text-[var(--success)]" />
      <DiffList title="Removed content" values={removed} className="text-[var(--error)]" />
      <DiffList
        title="Rewritten content"
        values={rewritten}
        className="text-[var(--warning)]"
      />
      <DiffList
        title="Unchanged / accepted"
        values={unchanged}
        className="text-[var(--ink-tertiary)]"
      />
    </div>
  );
}

function DiffList({
  title,
  values,
  className,
}: {
  title: string;
  values: string[];
  className: string;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] p-3">
      <p className="text-xs font-medium">{title}</p>
      {values.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--ink-tertiary)]">None</p>
      ) : (
        <ul className={`mt-2 space-y-1 text-xs ${className}`}>
          {values.slice(0, 30).map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
