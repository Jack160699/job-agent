"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  History,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIndiaDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APPLICATION_ANSWER_DEFINITIONS,
  APPLICATION_ANSWER_DEFINITION_MAP,
} from "@/lib/applications/answer-bank";
import { toast } from "sonner";

interface AnswerVersion {
  id: string;
  answer: unknown;
  version: number;
  changeReason: string;
  confirmationState: string;
  createdAt: string;
}

interface AnswerUsage {
  id: string;
  usedAt: string;
  application: {
    id: string;
    job: { title: string; company: string };
  } | null;
}

interface AnswerItem {
  id: string;
  questionKey: string;
  questionLabel: string;
  answer: unknown;
  isSensitive: boolean;
  isPrivate: boolean;
  confirmationState: string;
  confirmedAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  version: number;
  versions: AnswerVersion[];
  usages: AnswerUsage[];
}

function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function AnswerBankManager() {
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formReady, setFormReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionKey, setQuestionKey] = useState(
    APPLICATION_ANSWER_DEFINITIONS[0].key
  );
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const definition = APPLICATION_ANSWER_DEFINITION_MAP.get(questionKey)!;
  const existingKeys = useMemo(
    () => new Set(answers.map((answer) => answer.questionKey)),
    [answers]
  );

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/answer-bank", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load answers");
      const nextAnswers = (data.answers ?? []) as AnswerItem[];
      setAnswers(nextAnswers);
      setQuestionKey((currentKey) => {
        const reserved = new Set(
          nextAnswers.map((answer) => answer.questionKey)
        );
        if (!reserved.has(currentKey)) return currentKey;
        return (
          APPLICATION_ANSWER_DEFINITIONS.find(
            (item) => !reserved.has(item.key)
          )?.key ?? currentKey
        );
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load answers");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setFormReady(true));
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const resetForm = (additionalExistingKey?: string) => {
    setEditingId(null);
    const reservedKeys = new Set(existingKeys);
    if (additionalExistingKey) reservedKeys.add(additionalExistingKey);
    const next =
      APPLICATION_ANSWER_DEFINITIONS.find(
        (item) => !reservedKeys.has(item.key)
      ) ?? APPLICATION_ANSWER_DEFINITIONS[0];
    setQuestionKey(next.key);
    setValue("");
    setConfirmed(false);
    setIsPrivate(true);
  };

  const edit = (answer: AnswerItem) => {
    setEditingId(answer.id);
    setQuestionKey(answer.questionKey);
    setValue(displayValue(answer.answer));
    setConfirmed(answer.confirmationState === "confirmed");
    setIsPrivate(answer.isPrivate);
    document.getElementById("answer-bank-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/answer-bank/${editingId}` : "/api/answer-bank",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionKey,
            answer: value,
            confirmed,
            isPrivate,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save answer");
      const savedAnswer = data.answer as Omit<
        AnswerItem,
        "versions" | "usages"
      >;
      setAnswers((current) => {
        const existing = current.find(
          (answer) => answer.id === savedAnswer.id
        );
        const next: AnswerItem = {
          ...savedAnswer,
          versions: existing?.versions ?? [],
          usages: existing?.usages ?? [],
        };
        return existing
          ? current.map((answer) =>
              answer.id === savedAnswer.id ? next : answer
            )
          : [next, ...current];
      });
      toast.success(
        confirmed
          ? "Confirmed answer saved for safe reuse"
          : "Draft saved; automation will not reuse it"
      );
      resetForm(savedAnswer.questionKey);
      void load(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save answer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (answer: AnswerItem) => {
    if (!window.confirm(`Delete “${answer.questionLabel}”?`)) return;
    const response = await fetch(`/api/answer-bank/${answer.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "Could not delete answer");
      return;
    }
    toast.success("Answer deleted");
    await load();
    if (editingId === answer.id) resetForm();
  };

  return (
    <div className="space-y-6" data-answer-bank-ready={formReady ? "true" : "false"}>
      <Card id="answer-bank-form">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Edit answer" : "Add answer"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
            <div className="space-y-2">
              <Label htmlFor="answer-field">Application field</Label>
              <select
                id="answer-field"
                aria-label="Application field"
                className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
                value={questionKey}
                disabled={!formReady || editingId != null}
                onChange={(event) => {
                  setQuestionKey(event.target.value);
                  setValue("");
                }}
              >
                {APPLICATION_ANSWER_DEFINITIONS.map((item) => (
                  <option
                    key={item.key}
                    value={item.key}
                    disabled={!editingId && existingKeys.has(item.key)}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--ink-tertiary)]">
                {definition.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer-value">Confirmed value</Label>
              {definition.inputType === "yes_no" ? (
                <select
                  id="answer-value"
                  className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : definition.inputType === "multiline" ? (
                <textarea
                  id="answer-value"
                  className="min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              ) : (
                <Input
                  id="answer-value"
                  type={definition.inputType}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </div>
          </div>

          {definition.legalOrEligibility && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-3 text-xs text-[var(--ink-secondary)]">
              This is a legal or eligibility answer. Kairela never infers it and
              will reuse it only after you explicitly confirm it.
            </div>
          )}

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I confirm this value is accurate
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={definition.sensitive || isPrivate}
                disabled={definition.sensitive}
                onChange={(event) => setIsPrivate(event.target.checked)}
              />
              Keep private
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="gap-1.5"
              disabled={!formReady || saving || !value.trim()}
              onClick={() => void save()}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save answer"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => resetForm()}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-[var(--ink-tertiary)]">Loading answer bank…</p>
      ) : answers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--ink-secondary)]">
            No answers saved. Automation will pause whenever an application
            requires information that is not confirmed here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {answers.map((answer) => (
            <Card key={answer.id} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{answer.questionLabel}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-1">
                        {answer.confirmationState === "confirmed" ? (
                          <CheckCircle2 className="h-3 w-3 text-[var(--success)]" />
                        ) : (
                          <Clock3 className="h-3 w-3 text-[var(--warning)]" />
                        )}
                        {answer.confirmationState === "confirmed"
                          ? "Confirmed"
                          : "Draft — not reusable"}
                      </span>
                      {answer.isPrivate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-1">
                          <LockKeyhole className="h-3 w-3" />
                          Private
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => edit(answer)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {answer.questionLabel}</span>
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => void remove(answer)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {answer.questionLabel}</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="break-words rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-3 text-sm text-[var(--ink)]">
                  {displayValue(answer.answer)}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[var(--ink-tertiary)]">Last used</dt>
                    <dd className="mt-1 text-[var(--ink)]">
                      {answer.lastUsedAt
                        ? formatIndiaDateTime(answer.lastUsedAt)
                        : "Never"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-tertiary)]">Applications</dt>
                    <dd className="mt-1 text-[var(--ink)]">{answer.usageCount}</dd>
                  </div>
                </dl>

                {answer.usages[0]?.application && (
                  <p className="text-xs text-[var(--ink-tertiary)]">
                    Last used for {answer.usages[0].application.job.title} at{" "}
                    {answer.usages[0].application.job.company}
                  </p>
                )}

                <details className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink)]">
                    <History className="h-3.5 w-3.5" />
                    Version history ({answer.versions.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {answer.versions.length === 0 ? (
                      <p className="text-xs text-[var(--ink-tertiary)]">
                        No previous versions.
                      </p>
                    ) : (
                      answer.versions.map((version) => (
                        <div key={version.id} className="border-t border-[var(--line)] pt-2 text-xs">
                          <p className="font-medium text-[var(--ink)]">
                            Version {version.version} · {version.changeReason.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 break-words text-[var(--ink-tertiary)]">
                            {displayValue(version.answer)}
                          </p>
                          <p className="mt-1 text-[var(--ink-tertiary)]">
                            {formatIndiaDateTime(version.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
