import prisma from "@/lib/db";
import type { UserPersona } from "@prisma/client";
import {
  computeCompletionPct,
  type OnboardingDraft,
  stepsForPersona,
} from "./steps";
import {
  applyConflictResolutions,
  mergeProfileFields,
  type FieldMergeInput,
  type FieldMergeOutcome,
} from "./merge-policy";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";

export async function getOrCreateOnboardingState(userId: string) {
  return prisma.onboardingState.upsert({
    where: { userId },
    create: { userId, currentStep: "welcome", draftData: {} },
    update: {},
  });
}

export async function loadOnboardingDraft(userId: string): Promise<OnboardingDraft> {
  const [user, settings, state, resume] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
    getOrCreateOnboardingState(userId),
    prisma.masterResume.findUnique({ where: { userId } }),
  ]);

  const draft = (state.draftData as OnboardingDraft | null) ?? {};

  return {
    persona: user?.persona ?? draft.persona,
    fullName: user?.fullName ?? draft.fullName,
    currentLocation: user?.currentLocation ?? draft.currentLocation,
    linkedinUrl: user?.linkedinUrl ?? draft.linkedinUrl,
    githubUrl: user?.githubUrl ?? draft.githubUrl,
    portfolioUrl: user?.portfolioUrl ?? draft.portfolioUrl,
    currentRole: settings?.currentRole ?? draft.currentRole,
    jobTitles: settings?.jobTitles?.length ? settings.jobTitles : draft.jobTitles,
    experienceYears: settings?.experienceYears ?? draft.experienceYears,
    locations: settings?.locations?.length ? settings.locations : draft.locations,
    workModes: settings?.workModes?.length ? settings.workModes : draft.workModes,
    willingToRelocate: settings?.willingToRelocate ?? draft.willingToRelocate,
    requiredSkills: settings?.requiredSkills?.length
      ? settings.requiredSkills
      : draft.requiredSkills,
    preferredSkills: settings?.preferredSkills?.length
      ? settings.preferredSkills
      : draft.preferredSkills,
    industries: settings?.industries?.length ? settings.industries : draft.industries,
    employmentTypes: settings?.employmentTypes?.length
      ? settings.employmentTypes
      : draft.employmentTypes,
    salaryMin: settings?.salaryMin ?? draft.salaryMin,
    salaryMax: settings?.salaryMax ?? draft.salaryMax,
    salaryCurrency: settings?.salaryCurrency ?? draft.salaryCurrency ?? "USD",
    currentSalary: settings?.currentSalary ?? draft.currentSalary,
    noticePeriodDays: settings?.noticePeriodDays ?? draft.noticePeriodDays,
    visaSponsorshipRequired:
      settings?.visaSponsorshipRequired ?? draft.visaSponsorshipRequired,
    workAuthorization: settings?.workAuthorization ?? draft.workAuthorization,
    travelWillingness: settings?.travelWillingness ?? draft.travelWillingness,
    targetCompanies: settings?.targetCompanies?.length
      ? settings.targetCompanies
      : draft.targetCompanies,
    excludedCompanies: settings?.excludedCompanies?.length
      ? settings.excludedCompanies
      : draft.excludedCompanies,
    matchThreshold: settings?.matchThreshold ?? draft.matchThreshold ?? 70,
    autoSubmitEnabled: settings?.autoSubmitEnabled ?? draft.autoSubmitEnabled,
    requireReview: settings?.requireReview ?? draft.requireReview ?? true,
    searchFrequencyHours:
      settings?.searchFrequencyHours ?? draft.searchFrequencyHours ?? 6,
    resumeText: resume?.rawText ?? draft.resumeText,
    resumeAccepted: Boolean(resume) || draft.resumeAccepted,
    ...draft,
  };
}

export async function saveOnboardingProgress(
  userId: string,
  patch: OnboardingDraft & { currentStep?: string; completedSteps?: string[] }
) {
  const existing = await loadOnboardingDraft(userId);
  const merged: OnboardingDraft = { ...existing, ...patch };
  const persona = (patch.persona ?? existing.persona ?? "JOB_SEEKER") as UserPersona;

  const resume = await prisma.masterResume.findUnique({ where: { userId } });
  const completionPct = computeCompletionPct(persona, merged, Boolean(resume));

  const state = await prisma.onboardingState.upsert({
    where: { userId },
    create: {
      userId,
      currentStep: patch.currentStep ?? "welcome",
      completedSteps: patch.completedSteps ?? [],
      draftData: merged as object,
      completionPct,
    },
    update: {
      ...(patch.currentStep ? { currentStep: patch.currentStep } : {}),
      ...(patch.completedSteps ? { completedSteps: patch.completedSteps } : {}),
      draftData: merged as object,
      completionPct,
    },
  });

  if (merged.fullName || merged.currentLocation || merged.linkedinUrl) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        persona,
        fullName: merged.fullName,
        currentLocation: merged.currentLocation,
        linkedinUrl: merged.linkedinUrl,
        githubUrl: merged.githubUrl,
        portfolioUrl: merged.portfolioUrl,
      },
    });
  }

  if (persona === "JOB_SEEKER" || persona === "EXPLORER") {
    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        jobTitles: merged.jobTitles ?? [],
        requiredSkills: merged.requiredSkills ?? [],
        preferredSkills: merged.preferredSkills ?? [],
        experienceYears: merged.experienceYears ?? null,
        locations: merged.locations ?? [],
        workModes: (merged.workModes as never) ?? ["REMOTE"],
        salaryMin: merged.salaryMin ?? null,
        salaryMax: merged.salaryMax ?? null,
        salaryCurrency: merged.salaryCurrency ?? "USD",
        currentSalary: merged.currentSalary ?? null,
        currentRole: merged.currentRole ?? null,
        noticePeriodDays: merged.noticePeriodDays ?? null,
        visaSponsorshipRequired: merged.visaSponsorshipRequired ?? false,
        workAuthorization: merged.workAuthorization ?? null,
        travelWillingness: merged.travelWillingness ?? null,
        willingToRelocate: merged.willingToRelocate ?? false,
        industries: merged.industries ?? [],
        employmentTypes: (merged.employmentTypes as never) ?? [],
        targetCompanies: merged.targetCompanies ?? [],
        excludedCompanies: merged.excludedCompanies ?? [],
        matchThreshold: merged.matchThreshold ?? 70,
        autoSubmitEnabled: merged.autoSubmitEnabled ?? false,
        requireReview: merged.requireReview ?? true,
        searchFrequencyHours: merged.searchFrequencyHours ?? 6,
        enabledSources: ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"],
      },
      update: {
        jobTitles: merged.jobTitles,
        requiredSkills: merged.requiredSkills,
        preferredSkills: merged.preferredSkills,
        experienceYears: merged.experienceYears,
        locations: merged.locations,
        workModes: merged.workModes as never,
        salaryMin: merged.salaryMin,
        salaryMax: merged.salaryMax,
        salaryCurrency: merged.salaryCurrency,
        currentSalary: merged.currentSalary,
        currentRole: merged.currentRole,
        noticePeriodDays: merged.noticePeriodDays,
        visaSponsorshipRequired: merged.visaSponsorshipRequired,
        workAuthorization: merged.workAuthorization,
        travelWillingness: merged.travelWillingness,
        willingToRelocate: merged.willingToRelocate,
        industries: merged.industries,
        employmentTypes: merged.employmentTypes as never,
        targetCompanies: merged.targetCompanies,
        excludedCompanies: merged.excludedCompanies,
        matchThreshold: merged.matchThreshold,
        autoSubmitEnabled: merged.autoSubmitEnabled,
        requireReview: merged.requireReview,
        searchFrequencyHours: merged.searchFrequencyHours,
      },
    });
  } else {
    await prisma.hiringProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: merged.companyName,
        companySize: merged.companySize,
        hiringGoal: merged.hiringGoal,
        rolesHired: merged.rolesHired ?? [],
        hiringVolume: merged.hiringVolume,
        teamMembers: merged.teamMembers ?? null,
        locations: merged.locations ?? [],
      },
      update: {
        companyName: merged.companyName,
        companySize: merged.companySize,
        hiringGoal: merged.hiringGoal,
        rolesHired: merged.rolesHired,
        hiringVolume: merged.hiringVolume,
        teamMembers: merged.teamMembers,
        locations: merged.locations,
      },
    });
  }

  return { state, draft: merged, completionPct, steps: stepsForPersona(persona) };
}

export async function completeOnboarding(userId: string) {
  const existingState = await prisma.onboardingState.findUnique({ where: { userId } });
  if (existingState?.isComplete) {
    // Idempotent: a refresh or repeated request must not duplicate consent
    // records, preference-history snapshots, or master resume rows.
    const draft = await loadOnboardingDraft(userId);
    return { persona: draft.persona ?? "JOB_SEEKER", complete: true };
  }

  const draft = await loadOnboardingDraft(userId);
  const persona = draft.persona ?? "JOB_SEEKER";

  const minViable =
    persona === "JOB_SEEKER"
      ? Boolean(
          draft.jobTitles?.length &&
            draft.requiredSkills?.length &&
            (draft.locations?.length || draft.workModes?.includes("REMOTE")) &&
            draft.experienceYears != null
        )
      : Boolean(draft.companyName && draft.hiringGoal);

  if (!minViable && persona === "JOB_SEEKER") {
    throw new Error("Complete required search preferences before finishing onboarding");
  }

  const resume = await prisma.masterResume.findUnique({ where: { userId } });
  if (persona === "JOB_SEEKER" && !resume && !draft.resumeText) {
    throw new Error("Upload a master resume before completing onboarding");
  }

  if (draft.resumeText && !resume) {
    const skills = extractSkillsFromText(draft.resumeText);
    await prisma.masterResume.upsert({
      where: { userId },
      create: {
        userId,
        rawText: draft.resumeText,
        content: { sections: [] },
        skills,
      },
      update: {
        rawText: draft.resumeText,
        skills,
      },
    });
  }

  const snapshot = await prisma.userSettings.findUnique({ where: { userId } });
  if (snapshot) {
    const lastVersion = await prisma.preferenceHistory.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
    });
    await prisma.preferenceHistory.create({
      data: {
        userId,
        version: (lastVersion?.version ?? 0) + 1,
        snapshot: snapshot as object,
        changedFields: ["onboarding_complete"],
      },
    });
  }

  await prisma.consentRecord.create({
    data: {
      userId,
      consentType: "onboarding_complete",
      granted: true,
      metadata: { persona, completedAt: new Date().toISOString() },
    },
  });

  const complete = persona === "EXPLORER" || persona !== "JOB_SEEKER" || minViable;

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      jobTitles: draft.jobTitles ?? [],
      requiredSkills: draft.requiredSkills ?? [],
      preferencesComplete: complete && persona === "JOB_SEEKER",
      onboardingCompletedAt: new Date(),
      enabledSources: ["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY"],
    },
    update: {
      preferencesComplete: complete && persona === "JOB_SEEKER",
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.onboardingState.update({
    where: { userId },
    data: {
      isComplete: true,
      completedAt: new Date(),
      currentStep: "complete",
      completionPct: 100,
    },
  });

  return { persona, complete };
}

function extractSkillsFromText(text: string): string[] {
  const keywords = [
    "typescript", "javascript", "react", "node", "python", "java", "sql",
    "aws", "docker", "kubernetes", "postgres", "graphql", "next.js",
  ];
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k));
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const state = await prisma.onboardingState.findUnique({ where: { userId } });
  if (state?.isComplete) return true;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return Boolean(settings?.onboardingCompletedAt && settings.preferencesComplete);
}

/**
 * Resume-first entry routing: if onboarding hasn't progressed past the
 * welcome/resume steps but a master resume already exists (uploaded in a
 * prior session, or via Settings), jump straight to the review screen
 * instead of asking the user to upload again.
 */
export async function resolveEntryStep(userId: string): Promise<string | null> {
  const [state, user] = await Promise.all([
    getOrCreateOnboardingState(userId),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  const persona = (user?.persona ?? "JOB_SEEKER") as UserPersona;
  if (persona !== "JOB_SEEKER" && persona !== "EXPLORER") return null;
  if (state.isComplete) return null;
  if (state.currentStep !== "welcome" && state.currentStep !== "resume") return null;

  const resume = await prisma.masterResume.findUnique({ where: { userId } });
  if (!resume) return null;

  const completedSteps = Array.from(new Set([...state.completedSteps, "welcome", "resume"]));
  await prisma.onboardingState.update({
    where: { userId },
    data: { currentStep: "review", completedSteps },
  });
  return "review";
}

const REVIEW_FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  currentLocation: "Current location",
  currentRole: "Current role",
  jobTitles: "Target job titles",
  experienceYears: "Years of experience",
  requiredSkills: "Skills",
  linkedinUrl: "LinkedIn URL",
  githubUrl: "GitHub URL",
  portfolioUrl: "Portfolio URL",
};

/**
 * Compares resume-extracted values against the user's existing (already
 * confirmed) profile and decides, per field, whether to auto-fill, keep, or
 * flag a conflict for the user to resolve. See ./merge-policy for the rules.
 */
export async function computeReviewMerge(
  userId: string,
  profile: ParsedCareerProfile
): Promise<{ outcomes: FieldMergeOutcome[]; conflicts: FieldMergeOutcome[] }> {
  const [draft, state] = await Promise.all([
    loadOnboardingDraft(userId),
    getOrCreateOnboardingState(userId),
  ]);
  const alreadyConfirmedOnce =
    state.isComplete ||
    state.completedSteps.includes("review") ||
    state.completedSteps.includes("preferences");

  const inputs: FieldMergeInput[] = [
    {
      key: "fullName",
      label: REVIEW_FIELD_LABELS.fullName,
      existingValue: draft.fullName ?? null,
      incomingValue: profile.fullName.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "currentLocation",
      label: REVIEW_FIELD_LABELS.currentLocation,
      existingValue: draft.currentLocation ?? null,
      incomingValue: profile.currentLocation.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "currentRole",
      label: REVIEW_FIELD_LABELS.currentRole,
      existingValue: draft.currentRole ?? null,
      incomingValue: profile.currentRole.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "jobTitles",
      label: REVIEW_FIELD_LABELS.jobTitles,
      existingValue: draft.jobTitles ?? null,
      incomingValue: profile.jobTitles.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "experienceYears",
      label: REVIEW_FIELD_LABELS.experienceYears,
      existingValue: draft.experienceYears ?? null,
      incomingValue: profile.experienceYears.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "requiredSkills",
      label: REVIEW_FIELD_LABELS.requiredSkills,
      existingValue: draft.requiredSkills ?? null,
      incomingValue: profile.skills.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "linkedinUrl",
      label: REVIEW_FIELD_LABELS.linkedinUrl,
      existingValue: draft.linkedinUrl ?? null,
      incomingValue: profile.linkedinUrl.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "githubUrl",
      label: REVIEW_FIELD_LABELS.githubUrl,
      existingValue: draft.githubUrl ?? null,
      incomingValue: profile.githubUrl.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
    {
      key: "portfolioUrl",
      label: REVIEW_FIELD_LABELS.portfolioUrl,
      existingValue: draft.portfolioUrl ?? null,
      incomingValue: profile.portfolioUrl.value,
      existingConfirmed: alreadyConfirmedOnce,
    },
  ];

  return mergeProfileFields(inputs);
}

function pick<T>(edits: Record<string, unknown>, key: string, fallback: T | undefined): T | undefined {
  return Object.prototype.hasOwnProperty.call(edits, key) ? (edits[key] as T) : fallback;
}

/**
 * Finalizes the review step: any unresolved conflict blocks persistence and
 * is returned to the caller for the user to decide. Explicit `edits` (fields
 * the user typed over in the review UI) always win over the merge outcome.
 */
export async function confirmReview(
  userId: string,
  profile: ParsedCareerProfile,
  input: {
    resolutions?: Record<string, "existing" | "incoming">;
    edits?: Record<string, unknown>;
  } = {}
): Promise<
  | { ok: true; state: unknown; draft: OnboardingDraft; completionPct: number }
  | { ok: false; conflicts: FieldMergeOutcome[] }
> {
  const { outcomes, conflicts } = await computeReviewMerge(userId, profile);
  const resolutions = input.resolutions ?? {};
  const edits = input.edits ?? {};

  const unresolved = conflicts.filter(
    (c) => !(c.key in resolutions) && !(c.key in edits)
  );
  if (unresolved.length > 0) {
    return { ok: false, conflicts: unresolved };
  }

  const resolved = applyConflictResolutions(outcomes, resolutions);
  const state = await getOrCreateOnboardingState(userId);
  const completedSteps = Array.from(new Set([...state.completedSteps, "welcome", "resume", "review"]));

  const result = await saveOnboardingProgress(userId, {
    fullName: pick(edits, "fullName", resolved.fullName as string | undefined),
    currentLocation: pick(edits, "currentLocation", resolved.currentLocation as string | undefined),
    currentRole: pick(edits, "currentRole", resolved.currentRole as string | undefined),
    jobTitles: pick(edits, "jobTitles", resolved.jobTitles as string[] | undefined),
    experienceYears: pick(edits, "experienceYears", resolved.experienceYears as number | null | undefined),
    requiredSkills: pick(edits, "requiredSkills", resolved.requiredSkills as string[] | undefined),
    linkedinUrl: pick(edits, "linkedinUrl", resolved.linkedinUrl as string | undefined),
    githubUrl: pick(edits, "githubUrl", resolved.githubUrl as string | undefined),
    portfolioUrl: pick(edits, "portfolioUrl", resolved.portfolioUrl as string | undefined),
    resumeAccepted: true,
    currentStep: "preferences",
    completedSteps,
  });

  return { ok: true, ...result };
}
