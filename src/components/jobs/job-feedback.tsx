"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const REASONS = [
  ["wrong_role", "Wrong role"],
  ["wrong_location", "Wrong location"],
  ["wrong_seniority", "Wrong seniority"],
  ["wrong_salary", "Wrong salary"],
  ["wrong_work_mode", "Wrong work mode"],
  ["not_interested", "Not interested"],
  ["misleading_posting", "Misleading posting"],
  ["other", "Other"],
] as const;

type FeedbackState = {
  relevant: boolean;
  reason: string | null;
} | null;

export function JobFeedbackControl({
  jobId,
  initialFeedback,
}: {
  jobId: string;
  initialFeedback: FeedbackState;
}) {
  const [feedback, setFeedback] = useState<FeedbackState>(initialFeedback);
  const [saving, setSaving] = useState(false);

  const save = async (next: Exclude<FeedbackState, null>) => {
    const previous = feedback;
    setFeedback(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Feedback update failed.");
      toast.success("Match feedback saved");
    } catch (error) {
      setFeedback(previous);
      toast.error(
        error instanceof Error ? error.message : "Feedback update failed."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Match feedback">
      <span className="mr-1 text-xs text-[var(--ink-tertiary)]">Useful?</span>
      <Button
        type="button"
        variant={feedback?.relevant === true ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        disabled={saving}
        onClick={() => void save({ relevant: true, reason: "good_match" })}
        aria-label="Mark this job relevant"
        aria-pressed={feedback?.relevant === true}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant={feedback?.relevant === false ? "default" : "ghost"}
        size="icon"
        className="h-8 w-8"
        disabled={saving}
        onClick={() =>
          void save({ relevant: false, reason: "not_interested" })
        }
        aria-label="Mark this job not relevant"
        aria-pressed={feedback?.relevant === false}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      {feedback?.relevant === false && (
        <label className="sr-only" htmlFor={`feedback-reason-${jobId}`}>
          Why is this job not relevant?
        </label>
      )}
      {feedback?.relevant === false && (
        <select
          id={`feedback-reason-${jobId}`}
          value={feedback.reason ?? "not_interested"}
          disabled={saving}
          onChange={(event) =>
            void save({ relevant: false, reason: event.target.value })
          }
          className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink-secondary)]"
        >
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
