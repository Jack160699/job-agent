"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  SafeFixActionType,
  SafeFixReviewState,
} from "@/lib/resumes/safe-fix-review";

export function SafeFixReviewPanel({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const [review, setReview] = useState<SafeFixReviewState | null>(null);
  const [resumeVersion, setResumeVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/resumes/${resumeId}/review`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Review failed to load");
        setReview(body.review);
        setResumeVersion(body.resumeVersion);
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error ? loadError.message : "Review failed to load"
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [resumeId]);

  const runAction = useCallback(
    async (
      action: SafeFixActionType,
      options: { fixId?: string; confirmed?: boolean } = {}
    ) => {
      const operation = options.fixId ?? action;
      setBusy(operation);
      setError(null);
      try {
        const response = await fetch(`/api/resumes/${resumeId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...options }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Review action failed");
        setReview(body.review);
        setResumeVersion(body.resumeVersion);
        if (body.changedContent) router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Review action failed"
        );
      } finally {
        setBusy(null);
      }
    },
    [resumeId, router]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || busy) return;
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        void runAction("ACCEPT_ALL_SAFE");
      }
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        void runAction("UNDO_LAST");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, runAction]);

  if (loading) {
    return (
      <p className="mt-4 text-xs text-[var(--ink-tertiary)]" role="status">
        Loading safe-fix review…
      </p>
    );
  }

  const fixes = review?.fixes ?? [];
  const pending = fixes.filter((fix) => fix.status === "PENDING");
  const safePending = pending.filter((fix) => !fix.requiresConfirmation);
  const canUndo = (review?.actions ?? []).some(
    (action) =>
      (action.type === "ACCEPT" || action.type === "ACCEPT_ALL_SAFE") &&
      !action.undoneAt
  );

  return (
    <section
      className="mt-5 space-y-3"
      aria-labelledby={`safe-fix-title-${resumeId}`}
    >
      <div>
        <h4
          id={`safe-fix-title-${resumeId}`}
          className="flex items-center gap-2 font-medium"
        >
          <ShieldCheck className="h-4 w-4" />
          ATS safe-fix approval
        </h4>
        <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
          Every accepted content change creates a resume version. Alt+A accepts
          all deterministically safe fixes; Alt+Z undoes the last acceptance.
        </p>
        {resumeVersion != null && (
          <p className="mt-1 text-xs font-medium text-[var(--ink-secondary)]">
            Current resume version: {resumeVersion}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={safePending.length === 0 || Boolean(busy)}
          onClick={() => void runAction("ACCEPT_ALL_SAFE")}
        >
          Accept all safe ({safePending.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending.length === 0 || Boolean(busy)}
          onClick={() => void runAction("REJECT_ALL")}
        >
          Reject all
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canUndo || Boolean(busy)}
          onClick={() => void runAction("UNDO_LAST")}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Undo last
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canUndo || Boolean(busy)}
          onClick={() => void runAction("UNDO_ALL")}
        >
          Undo all
        </Button>
      </div>

      {error && (
        <p
          className="rounded-md border border-[var(--error)]/30 bg-[var(--error-muted)] p-2 text-xs text-[var(--error)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {fixes.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-xs text-[var(--ink-tertiary)]">
          No deterministic safe fixes are proposed for this version.
        </p>
      ) : (
        <div className="space-y-3">
          {fixes.map((fix) => (
            <article
              key={fix.id}
              className="rounded-md border border-[var(--line)] p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--ink)]">
                  {fix.section} · {fix.category.replaceAll("_", " ")}
                </span>
                <span className="rounded bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px]">
                  {fix.status}
                </span>
                <span className="text-[10px] text-[var(--ink-tertiary)]">
                  {fix.riskLevel} risk
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded bg-[var(--error-muted)] p-2">
                  <p className="font-medium">Original</p>
                  <p className="mt-1 whitespace-pre-wrap">{fix.originalContent}</p>
                </div>
                <div className="rounded bg-[var(--success-muted)] p-2">
                  <p className="font-medium">Proposed</p>
                  <p className="mt-1 whitespace-pre-wrap">{fix.proposedContent}</p>
                </div>
              </div>
              <p className="mt-2 text-[var(--ink-secondary)]">
                {fix.explanation}
              </p>
              <p className="mt-1 text-[var(--ink-tertiary)]">
                Source evidence: {fix.sourceEvidence}
              </p>
              <p className="mt-1 text-[var(--ink-tertiary)]">
                Validation: {fix.deterministicValidation.reason}
              </p>
              {fix.requiresConfirmation && (
                <p className="mt-1 font-medium text-[var(--warning)]">
                  Factual meaning may change. Explicit confirmation is required.
                </p>
              )}
              {fix.acceptedAt && (
                <p className="mt-1 text-[10px] text-[var(--success)]">
                  Accepted {new Date(fix.acceptedAt).toLocaleString()} · proposed
                  for version {fix.resumeVersion}
                </p>
              )}
              {fix.rejectedAt && (
                <p className="mt-1 text-[10px] text-[var(--ink-tertiary)]">
                  Rejected {new Date(fix.rejectedAt).toLocaleString()} · proposed
                  for version {fix.resumeVersion}
                </p>
              )}
              {fix.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const confirmed =
                        !fix.requiresConfirmation ||
                        window.confirm(
                          "Confirm that the proposed factual wording is accurate and supported by your source resume."
                        );
                      if (confirmed) {
                        void runAction("ACCEPT", {
                          fixId: fix.id,
                          confirmed: fix.requiresConfirmation,
                        });
                      }
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept fix
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void runAction("REJECT", { fixId: fix.id })
                    }
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject fix
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
