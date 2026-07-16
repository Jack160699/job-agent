"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { trackOnboardingEvent } from "@/lib/analytics/events";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import { RESUME_FIRST_TOKENS } from "./resume-first/tokens";
import { ResumeEntryScreen } from "./resume-first/resume-entry-screen";
import { ReviewScreen } from "./resume-first/review-screen";
import { PreferencesScreen } from "./resume-first/preferences-screen";
import type { MasterResumeUploadResult } from "./resume-first/types";

export function ConversationalOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<OnboardingStepId>("welcome");
  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [completionPct, setCompletionPct] = useState(0);
  const [profile, setProfile] = useState<ParsedCareerProfile | null>(null);
  const reviewFetchStartedRef = useRef(false);
  const [hiringGoal, setHiringGoal] = useState("");

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

  // When landing directly on "review" (a master resume already exists from a
  // prior session or from Settings), fetch its stored profile.
  useEffect(() => {
    if (step !== "review" || profile || reviewFetchStartedRef.current) return;
    reviewFetchStartedRef.current = true;
    fetch("/api/resumes/master")
      .then((res) => res.json())
      .then((data) => {
        if (data?.profile) setProfile(data.profile);
        else setStep("resume");
      })
      .catch(() => setStep("resume"));
  }, [step, profile]);

  const savePersona = async (persona: OnboardingDraft["persona"]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: { ...draft, persona }, persona, currentStep: "welcome", nav: "next" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDraft(data.draft ?? { ...draft, persona });
      setStep((data.state?.currentStep as OnboardingStepId) ?? "resume");
      setCompletionPct(data.completionPct ?? completionPct);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipResume = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip_resume" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not continue without a resume");
      setDraft(data.draft ?? { ...draft, resumeSkipped: true });
      setStep("preferences");
      setCompletionPct(data.completionPct ?? completionPct);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setSaving(false);
    }
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
      trackOnboardingEvent("onboarding_completed");
      toast.success("Welcome to Kairela!");
      router.push(data.persona === "JOB_SEEKER" ? "/dashboard/jobs" : "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setSaving(false);
    }
  };

  const handleHiringNext = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: { ...draft, hiringGoal },
          currentStep: step,
          nav: "next",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDraft(data.draft ?? draft);
      setStep((data.state?.currentStep as OnboardingStepId) ?? step);
      setCompletionPct(data.completionPct ?? completionPct);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
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

  const isResumeFirstStep = step === "resume" || step === "review" || step === "preferences";

  return (
    <div
      className={cn(
        "mx-auto max-w-lg space-y-5 pb-8",
        step === "welcome" &&
          "flex min-h-[calc(100dvh-var(--header-height)-var(--bottom-nav-height)-var(--safe-top)-var(--safe-bottom)-2rem)] flex-col justify-center py-6 md:min-h-0 md:justify-start md:py-0"
      )}
      style={isResumeFirstStep ? RESUME_FIRST_TOKENS : undefined}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--ink-tertiary)]">
          <span>Profile completion</span>
          <span className="tabular-nums font-medium text-[var(--accent)]">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
      </div>

      {step === "welcome" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h1 className="text-lg font-semibold text-[var(--ink)]">{STEP_LABELS[step]}</h1>
              <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">{STEP_WHY[step]}</p>
            </div>
            <div className="space-y-2">
              {availablePersonas.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => void savePersona(choice.id)}
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
          </CardContent>
        </Card>
      )}

      {step === "resume" && (
        <Card className="border-[var(--rf-line)] bg-[var(--rf-bg)]">
          <CardContent className="pt-6">
            <ResumeEntryScreen
              skipping={saving}
              onSkip={handleSkipResume}
              onUploaded={(result: MasterResumeUploadResult) => {
                setProfile(result.profile);
                setStep("review");
              }}
            />
          </CardContent>
        </Card>
      )}

      {step === "review" &&
        (!profile ? (
          <Card className="border-[var(--rf-line)] bg-[var(--rf-bg)]">
            <CardContent className="pt-6">
              <p className="py-8 text-center text-sm text-[var(--ink-tertiary)]">Loading your review…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[var(--rf-line)] bg-[var(--rf-bg)]">
            <CardContent className="pt-6">
              <ReviewScreen
                profile={profile}
                onReupload={() => {
                  setProfile(null);
                  setStep("resume");
                }}
                onCompleted={() => {
                  setStep("preferences");
                  void load();
                }}
              />
            </CardContent>
          </Card>
        ))}

      {step === "preferences" && (
        <Card className="border-[var(--rf-line)] bg-[var(--rf-bg)]">
          <CardContent className="pt-6">
            <PreferencesScreen
              draft={draft}
              onCompleted={(nextDraft) => {
                setDraft(nextDraft);
                setStep("complete");
                void load();
              }}
            />
          </CardContent>
        </Card>
      )}

      {step === "hiring_basics" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <h1 className="text-lg font-semibold text-[var(--ink)]">{STEP_LABELS[step]}</h1>
              <p className="mt-1.5 text-sm text-[var(--ink-secondary)]">{STEP_WHY[step]}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[var(--ink-secondary)]" htmlFor="hiring-goal">
                Hiring goal
              </label>
              <Input
                id="hiring-goal"
                className="h-11"
                placeholder="Hire 3 engineers this quarter"
                value={hiringGoal}
                onChange={(e) => setHiringGoal(e.target.value)}
              />
            </div>
            <Button className="h-11 w-full" onClick={handleHiringNext} disabled={saving}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">
            <h1 className="text-lg font-semibold text-[var(--ink)]">{STEP_LABELS[step]}</h1>
            <p className="text-sm text-[var(--ink-secondary)]">
              Your profile is ready. Kairela can now find better-matched opportunities.
            </p>
            <Button className="h-11 w-full" onClick={handleComplete} disabled={saving}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
