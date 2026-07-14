"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type OnboardingDraft,
  type OnboardingStepId,
  PERSONA_CHOICES,
  STEP_LABELS,
  STEP_WHY,
} from "@/lib/onboarding/steps";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const WORK_MODES = [
  { id: "REMOTE", label: "Remote" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ONSITE", label: "On-site" },
];

function splitCsv(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinCsv(values?: string[]): string {
  return values?.join(", ") ?? "";
}

export function ConversationalOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<OnboardingStepId>("welcome");
  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [completionPct, setCompletionPct] = useState(0);
  const [parsedPreview, setParsedPreview] = useState<OnboardingDraft["resumeParsed"] | null>(null);
  const [resumeAccepted, setResumeAccepted] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/onboarding");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");
    setDraft(data.draft ?? {});
    setStep((data.state?.currentStep as OnboardingStepId) ?? "welcome");
    setCompletionPct(data.state?.completionPct ?? 0);
    if (data.state?.isComplete) router.replace("/dashboard/jobs");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch(() => {
        toast.error("Could not load onboarding");
        setLoading(false);
      });
    });
  }, [load]);

  const save = async (patch: Partial<OnboardingDraft>, nav?: "next" | "back") => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: { ...draft, ...patch },
          currentStep: step,
          nav,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDraft(data.draft);
      if (data.state?.currentStep) setStep(data.state.currentStep);
      if (data.completionPct != null) setCompletionPct(data.completionPct);
      if (nav === "next" && data.draft) setStep(data.state?.currentStep ?? step);
      return data;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async (patch: Partial<OnboardingDraft> = {}) => {
    const merged = { ...draft, ...patch };
    setDraft(merged);
    await save(patch, "next");
  };

  const handleBack = async () => {
    await save({}, "back");
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not complete");
      toast.success("Welcome to Kairela!");
      router.push(data.persona === "JOB_SEEKER" ? "/dashboard/jobs" : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setSaving(false);
    }
  };

  const parseResume = async () => {
    if (!draft.resumeText?.trim()) {
      toast.error("Paste your resume text first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parse_resume",
          resumeText: draft.resumeText,
          currentStep: step,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setParsedPreview(data.parsed);
      setDraft(data.draft);
      toast.success("Review extracted details before accepting");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setSaving(false);
    }
  };

  const acceptParsed = async () => {
    if (!parsedPreview) return;
    const patch: Partial<OnboardingDraft> = {
      resumeAccepted: true,
      requiredSkills: parsedPreview.skills?.length
        ? [...new Set([...(draft.requiredSkills ?? []), ...parsedPreview.skills])]
        : draft.requiredSkills,
      experienceYears: parsedPreview.experienceYears ?? draft.experienceYears,
      jobTitles: parsedPreview.jobTitles?.length
        ? [...new Set([...(draft.jobTitles ?? []), ...parsedPreview.jobTitles])]
        : draft.jobTitles,
    };
    setResumeAccepted(true);
    setDraft((d) => ({ ...d, ...patch }));
    await save(patch);
    toast.success("Resume details applied to your profile");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center text-sm text-[var(--ink-tertiary)]">
        Loading your onboarding…
      </div>
    );
  }

  const availablePersonas = PERSONA_CHOICES.filter((p) => {
    if (!p.requiresFlag) return true;
    return FEATURE_FLAGS[p.requiresFlag];
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--ink-tertiary)]">
          <span>Profile completion</span>
          <span className="tabular-nums font-medium text-[var(--accent)]">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h1 className="text-lg font-semibold text-[var(--ink)]">{STEP_LABELS[step]}</h1>
            <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">{STEP_WHY[step]}</p>
          </div>

          {step === "welcome" && (
            <div className="space-y-2">
              {availablePersonas.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleNext({ persona: choice.id })}
                  disabled={saving}
                  className={cn(
                    "tap-active w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors",
                    draft.persona === choice.id
                      ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                      : "border-[var(--line)] hover:border-[var(--line-strong)]"
                  )}
                >
                  <p className="text-sm font-semibold text-[var(--ink)]">{choice.title}</p>
                  <p className="mt-1 text-xs text-[var(--ink-secondary)]">{choice.description}</p>
                </button>
              ))}
            </div>
          )}

          {step === "basics" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  className="h-11"
                  value={draft.fullName ?? ""}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Current location</Label>
                <Input
                  className="h-11"
                  placeholder="Pune, India"
                  value={draft.currentLocation ?? ""}
                  onChange={(e) => setDraft({ ...draft, currentLocation: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === "goals" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Current role</Label>
                <Input
                  className="h-11"
                  value={draft.currentRole ?? ""}
                  onChange={(e) => setDraft({ ...draft, currentRole: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target job titles *</Label>
                <Input
                  className="h-11"
                  placeholder="Frontend Developer, React Engineer"
                  value={joinCsv(draft.jobTitles)}
                  onChange={(e) => setDraft({ ...draft, jobTitles: splitCsv(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Years of experience *</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-11"
                  value={draft.experienceYears ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      experienceYears: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                />
              </div>
            </div>
          )}

          {step === "location" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Preferred locations</Label>
                <Input
                  className="h-11"
                  placeholder="Pune, Bangalore, Remote"
                  value={joinCsv(draft.locations)}
                  onChange={(e) => setDraft({ ...draft, locations: splitCsv(e.target.value) })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {WORK_MODES.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    variant={(draft.workModes ?? []).includes(m.id) ? "default" : "outline"}
                    onClick={() => {
                      const modes = draft.workModes ?? [];
                      const next = modes.includes(m.id)
                        ? modes.filter((x) => x !== m.id)
                        : [...modes, m.id];
                      setDraft({ ...draft, workModes: next });
                    }}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.willingToRelocate ?? false}
                  onChange={(e) => setDraft({ ...draft, willingToRelocate: e.target.checked })}
                />
                Willing to relocate
              </label>
            </div>
          )}

          {step === "skills" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Primary skills *</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.requiredSkills)}
                  onChange={(e) =>
                    setDraft({ ...draft, requiredSkills: splitCsv(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Secondary skills (optional)</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.preferredSkills)}
                  onChange={(e) =>
                    setDraft({ ...draft, preferredSkills: splitCsv(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Industries (optional)</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.industries)}
                  onChange={(e) => setDraft({ ...draft, industries: splitCsv(e.target.value) })}
                />
              </div>
            </div>
          )}

          {step === "compensation" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Expected salary min</Label>
                  <Input
                    type="number"
                    className="h-11"
                    value={draft.salaryMin ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        salaryMin: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected salary max</Label>
                  <Input
                    type="number"
                    className="h-11"
                    value={draft.salaryMax ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        salaryMax: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  className="h-11"
                  value={draft.salaryCurrency ?? "USD"}
                  onChange={(e) => setDraft({ ...draft, salaryCurrency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notice period (days, optional)</Label>
                <Input
                  type="number"
                  className="h-11"
                  value={draft.noticePeriodDays ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      noticePeriodDays: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.visaSponsorshipRequired ?? false}
                  onChange={(e) =>
                    setDraft({ ...draft, visaSponsorshipRequired: e.target.checked })
                  }
                />
                Visa or sponsorship required
              </label>
            </div>
          )}

          {step === "companies" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Companies to include (optional)</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.targetCompanies)}
                  onChange={(e) =>
                    setDraft({ ...draft, targetCompanies: splitCsv(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Companies to exclude</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.excludedCompanies)}
                  onChange={(e) =>
                    setDraft({ ...draft, excludedCompanies: splitCsv(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum match score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-11"
                  value={draft.matchThreshold ?? 70}
                  onChange={(e) =>
                    setDraft({ ...draft, matchThreshold: parseFloat(e.target.value) || 70 })
                  }
                />
              </div>
            </div>
          )}

          {step === "resume" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Master resume *</Label>
                <textarea
                  className="min-h-[160px] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-3 text-sm"
                  placeholder="Paste your resume text here…"
                  value={draft.resumeText ?? ""}
                  onChange={(e) => setDraft({ ...draft, resumeText: e.target.value })}
                />
              </div>
              <Button type="button" variant="outline" onClick={parseResume} disabled={saving}>
                Extract details with Kairela
              </Button>
              {parsedPreview && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 text-xs space-y-2">
                  <p className="font-medium text-[var(--ink)]">Review before accepting:</p>
                  {parsedPreview.skills?.length ? (
                    <p>Skills: {parsedPreview.skills.join(", ")}</p>
                  ) : null}
                  {parsedPreview.experienceYears != null ? (
                    <p>Experience: {parsedPreview.experienceYears} years</p>
                  ) : null}
                  {parsedPreview.jobTitles?.length ? (
                    <p>Titles: {parsedPreview.jobTitles.join(", ")}</p>
                  ) : null}
                  <Button type="button" size="sm" onClick={acceptParsed} disabled={resumeAccepted}>
                    {resumeAccepted ? (
                      <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Accepted</span>
                    ) : (
                      "Accept extracted data"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === "apply_prefs" && (
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.requireReview ?? true}
                  onChange={(e) => setDraft({ ...draft, requireReview: e.target.checked })}
                />
                Review applications before Kairela submits
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.autoSubmitEnabled ?? false}
                  onChange={(e) => setDraft({ ...draft, autoSubmitEnabled: e.target.checked })}
                />
                Allow auto-apply when match quality is high (requires master resume)
              </label>
              <div className="space-y-2">
                <Label>Job alert frequency (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-11"
                  value={draft.searchFrequencyHours ?? 6}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      searchFrequencyHours: parseInt(e.target.value, 10) || 6,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn URL (optional)</Label>
                <Input
                  className="h-11"
                  value={draft.linkedinUrl ?? ""}
                  onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === "hiring_basics" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Company or agency name</Label>
                <Input
                  className="h-11"
                  value={draft.companyName ?? ""}
                  onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hiring goal</Label>
                <Input
                  className="h-11"
                  placeholder="Hire 3 engineers this quarter"
                  value={draft.hiringGoal ?? ""}
                  onChange={(e) => setDraft({ ...draft, hiringGoal: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Roles commonly hired</Label>
                <Input
                  className="h-11"
                  value={joinCsv(draft.rolesHired)}
                  onChange={(e) => setDraft({ ...draft, rolesHired: splitCsv(e.target.value) })}
                />
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-3 text-sm text-[var(--ink-secondary)]">
              <p>Your Kairela profile is ready at {completionPct}% completion.</p>
              <p>You can update any preference from Settings at any time.</p>
            </div>
          )}

          {step !== "welcome" && (
            <div className="flex gap-2 pt-2">
              {step !== "complete" && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={handleBack}
                  disabled={saving || step === "basics"}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              {step === "complete" ? (
                <Button className="h-11 flex-1" onClick={handleComplete} disabled={saving}>
                  Go to dashboard
                </Button>
              ) : (
                <Button
                  className="h-11 flex-1"
                  onClick={() => handleNext(draft)}
                  disabled={saving}
                >
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
