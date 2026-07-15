"use client";

import { Button } from "@/components/ui/button";
import { FileDown, FileText, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ApplicationActions({
  applicationId,
  status,
  failureReason,
  browserTaskId,
  hasDocuments = false,
  jobStatus = "ACTIVE",
}: {
  applicationId: string;
  status: string;
  failureReason?: string | null;
  browserTaskId?: string | null;
  hasDocuments?: boolean;
  jobStatus?: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!browserTaskId || (status !== "SUBMITTING" && status !== "PENDING_REVIEW")) {
      return;
    }

    const poll = async () => {
      try {
        const response = await fetch("/api/browser/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", taskId: browserTaskId }),
        });
        const data = await response.json();
        if (!response.ok) return;
        setTaskStatus(data.task?.status ?? null);
        if (
          data.task?.status === "completed" ||
          data.task?.status === "failed" ||
          data.task?.status === "cancelled"
        ) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          router.refresh();
        }
      } catch {
        // Transient poll failures are safe to ignore.
      }
    };

    void poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [browserTaskId, router, status]);

  const downloadPdf = async () => {
    setLoading("pdf");
    try {
      const res = await fetch(`/api/applications/${applicationId}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${applicationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Resume PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setLoading(null);
    }
  };

  const cancelTask = async () => {
    if (!browserTaskId) return;
    setLoading("cancel");
    try {
      const response = await fetch("/api/browser/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", taskId: browserTaskId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cancellation failed");
      toast.success(
        data.cancelled
          ? "Automation cancelled. Documents already prepared remain available."
          : "No active automation was found."
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setLoading(null);
    }
  };

  const generateDocs = async (force = false) => {
    if (["EXPIRED", "CLOSED"].includes(jobStatus)) {
      toast.error("Expired or closed jobs cannot generate new application documents.");
      return;
    }
    setLoading(force ? "regenerate" : "generate");
    try {
      const res = await fetch("/api/jobs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          applicationId,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Document generation failed");
      toast.success(
        data.reused
          ? "Existing tailored documents are ready for review"
          : force
            ? "Documents regenerated"
            : "Tailored resume and cover letter generated"
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setLoading(null);
    }
  };

  const prepareSubmit = async (autoSubmit: boolean) => {
    if (["EXPIRED", "CLOSED"].includes(jobStatus)) {
      toast.error("This posting is expired or closed and cannot be prepared or submitted.");
      return;
    }
    if (!hasDocuments) {
      toast.error("Generate tailored documents before preparing or submitting.");
      return;
    }

    const confirmed =
      !autoSubmit ||
      window.confirm(
        "Submit this application now?\n\nConfirm only after reviewing every answer and document. Kairela will not invent missing information or bypass login and CAPTCHA steps."
      );
    if (!confirmed) return;

    setLoading(autoSubmit ? "submit" : "prepare");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmit, confirmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      toast.success(data.message || "Application prepared");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoading(null);
    }
  };

  const terminal = ["SUBMITTING", "SUBMITTED", "WITHDRAWN", "ACCEPTED"].includes(
    status
  );
  const unavailable = ["EXPIRED", "CLOSED"].includes(jobStatus);
  const showGenerate = !terminal && !unavailable;
  const canPrepare =
    !unavailable &&
    hasDocuments &&
    ["PENDING_REVIEW", "RESUME_GENERATED", "COVER_LETTER_GENERATED", "FAILED"].includes(
      status
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={downloadPdf}
          disabled={!!loading || !hasDocuments}
          className="gap-1"
        >
          <FileDown className="h-3 w-3" />
          PDF
        </Button>
        {status === "SUBMITTING" && browserTaskId && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={!!loading}
            onClick={() => void cancelTask()}
          >
            <Square className="h-3 w-3" />
            {loading === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        )}
        {status === "PENDING_REVIEW" && browserTaskId && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={!!loading}
            onClick={() => void cancelTask()}
          >
            <Square className="h-3 w-3" />
            {loading === "cancel" ? "Cancelling…" : "Cancel prep"}
          </Button>
        )}
        {showGenerate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void generateDocs(hasDocuments)}
            disabled={!!loading}
            className="gap-1"
          >
            <FileText className="h-3 w-3" />
            {loading === "generate" || loading === "regenerate"
              ? "Generating…"
              : hasDocuments
                ? "Regenerate docs"
                : "Generate docs"}
          </Button>
        )}
        {canPrepare && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void prepareSubmit(false)}
              disabled={!!loading}
              className="gap-1"
            >
              <Send className="h-3 w-3" />
              {loading === "prepare" ? "Preparing…" : "Prepare"}
            </Button>
            <Button
              size="sm"
              onClick={() => void prepareSubmit(true)}
              disabled={!!loading}
              className="gap-1"
            >
              <Send className="h-3 w-3" />
              {loading === "submit" ? "Submitting…" : "Submit"}
            </Button>
          </>
        )}
      </div>
      {(status === "SUBMITTING" || taskStatus) && (
        <p className="max-w-[220px] text-right text-[10px] text-[var(--ink-tertiary)]">
          Automation {taskStatus || "queued"}. Leave this page if needed.
        </p>
      )}
      {!hasDocuments && (
        <p className="max-w-[220px] text-right text-[10px] text-[var(--ink-tertiary)]">
          Generate tailored documents before prepare/submit.
        </p>
      )}
      {unavailable && (
        <p className="max-w-[220px] text-right text-[10px] text-[var(--warning)]">
          Posting expired or closed. Existing documents remain downloadable, but
          preparation and submission are blocked.
        </p>
      )}
      {failureReason && (
        <p className="max-w-[220px] text-right text-[10px] text-[var(--warning)]">
          {failureReason.replaceAll("_", " ")}
        </p>
      )}
    </div>
  );
}
