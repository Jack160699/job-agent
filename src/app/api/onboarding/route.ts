import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser } from "@/lib/api/auth";
import {
  completeOnboarding,
  computeReviewMerge,
  confirmReview,
  getOrCreateOnboardingState,
  isOnboardingComplete,
  loadOnboardingDraft,
  resolveEntryStep,
  saveOnboardingProgress,
} from "@/lib/onboarding/service";
import {
  nextStep,
  prevStep,
  STEP_LABELS,
  STEP_WHY,
  stepsForPersona,
  type OnboardingStepId,
} from "@/lib/onboarding/steps";
import { FEATURE_FLAGS, hiringPersonaEnabled } from "@/lib/feature-flags";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import type { UserPersona } from "@prisma/client";

export async function GET() {
  try {
    const user = await resolveApiUser();
    await resolveEntryStep(user.id);
    const [draft, state, complete] = await Promise.all([
      loadOnboardingDraft(user.id),
      getOrCreateOnboardingState(user.id),
      isOnboardingComplete(user.id),
    ]);

    const persona = (draft.persona ?? user.persona ?? "JOB_SEEKER") as UserPersona;

    return NextResponse.json({
      draft,
      state: {
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        completionPct: state.completionPct,
        isComplete: state.isComplete || complete,
      },
      persona,
      steps: stepsForPersona(persona),
      stepLabels: STEP_LABELS,
      stepWhy: STEP_WHY,
      featureFlags: FEATURE_FLAGS,
      hiringPersonaEnabled: hiringPersonaEnabled(persona),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === "complete") {
      const result = await completeOnboarding(user.id);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "skip_resume") {
      const state = await getOrCreateOnboardingState(user.id);
      const completedSteps = Array.from(
        new Set([...state.completedSteps, "welcome", "resume"])
      );
      const result = await saveOnboardingProgress(user.id, {
        resumeSkipped: true,
        currentStep: "preferences",
        completedSteps,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "review_preview") {
      const profile = body.profile as ParsedCareerProfile | undefined;
      if (!profile) {
        return NextResponse.json({ error: "A parsed resume profile is required." }, { status: 400 });
      }
      const { outcomes, conflicts } = await computeReviewMerge(user.id, profile);
      return NextResponse.json({ outcomes, conflicts });
    }

    if (action === "confirm_review") {
      const profile = body.profile as ParsedCareerProfile | undefined;
      if (!profile) {
        return NextResponse.json({ error: "A parsed resume profile is required." }, { status: 400 });
      }
      const outcome = await confirmReview(user.id, profile, {
        resolutions: body.resolutions,
        edits: body.edits,
      });
      if (!outcome.ok) {
        return NextResponse.json({ ok: false, conflicts: outcome.conflicts }, { status: 409 });
      }
      return NextResponse.json(outcome);
    }

    const persona = (body.persona ?? body.draft?.persona) as UserPersona | undefined;
    if (persona && !hiringPersonaEnabled(persona) && persona !== "JOB_SEEKER" && persona !== "EXPLORER") {
      return NextResponse.json(
        { error: "This persona is not available yet. Choose job seeker or explore." },
        { status: 403 }
      );
    }

    let currentStep = body.currentStep as OnboardingStepId | undefined;
    const nav = body.nav as "next" | "back" | undefined;
    const draft = await loadOnboardingDraft(user.id);
    const activePersona = (persona ?? draft.persona ?? "JOB_SEEKER") as UserPersona;

    if (nav === "next" && currentStep) {
      currentStep = nextStep(activePersona, currentStep) ?? currentStep;
    } else if (nav === "back" && currentStep) {
      currentStep = prevStep(activePersona, currentStep) ?? currentStep;
    }

    const completedSteps = Array.isArray(body.completedSteps)
      ? body.completedSteps
      : undefined;

    const result = await saveOnboardingProgress(user.id, {
      ...body.draft,
      ...body,
      persona: activePersona,
      currentStep,
      completedSteps,
    });

    return NextResponse.json({
      draft: result.draft,
      state: {
        currentStep: result.state.currentStep,
        completedSteps: result.state.completedSteps,
        completionPct: result.completionPct,
        isComplete: result.state.isComplete,
      },
      completionPct: result.completionPct,
      steps: result.steps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
