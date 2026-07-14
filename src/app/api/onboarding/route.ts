import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser } from "@/lib/api/auth";
import {
  completeOnboarding,
  getOrCreateOnboardingState,
  isOnboardingComplete,
  loadOnboardingDraft,
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
import type { UserPersona } from "@prisma/client";

export async function GET() {
  try {
    const user = await resolveApiUser();
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

    if (action === "parse_resume" && body.resumeText) {
      const text = String(body.resumeText);
      const skills = text
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean);
      const known = [
        "typescript", "javascript", "react", "node", "python", "java",
        "sql", "aws", "docker", "postgres", "graphql",
      ].filter((k) => skills.some((s) => s.includes(k)));

      const yearsMatch = text.match(/(\d+)\+?\s*years?/i);
      const titleMatch = text.match(
        /(?:software|frontend|backend|full[\s-]?stack|data)\s+\w+/i
      );

      const parsed = {
        skills: known,
        experienceYears: yearsMatch ? parseInt(yearsMatch[1], 10) : null,
        jobTitles: titleMatch ? [titleMatch[0]] : [],
      };

      const result = await saveOnboardingProgress(user.id, {
        resumeText: text,
        resumeParsed: parsed,
        currentStep: body.currentStep,
      });

      return NextResponse.json({ parsed, ...result });
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
