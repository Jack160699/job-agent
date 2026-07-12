import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveApiUserDev } from "@/lib/api/auth";
import prisma from "@/lib/db";
import { validateSearchPreferences } from "@/lib/jobs/preferences";
import { archiveLegacyJobs } from "@/lib/jobs/pipeline";

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    const validation = validateSearchPreferences(settings);
    return NextResponse.json({
      settings: settings
        ? {
            jobTitles: settings.jobTitles,
            requiredSkills: settings.requiredSkills,
            preferredSkills: settings.preferredSkills,
            experienceYears: settings.experienceYears,
            locations: settings.locations,
            workModes: settings.workModes,
            salaryMin: settings.salaryMin,
            salaryMax: settings.salaryMax,
            employmentTypes: settings.employmentTypes,
            visaSponsorshipRequired: settings.visaSponsorshipRequired,
            willingToRelocate: settings.willingToRelocate,
            industries: settings.industries,
            targetCompanies: settings.targetCompanies,
            excludedCompanies: settings.excludedCompanies,
            noticePeriodDays: settings.noticePeriodDays,
            matchThreshold: settings.matchThreshold,
            preferencesComplete: settings.preferencesComplete,
          }
        : null,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const body = await request.json();
    const complete = Boolean(body.preferencesComplete);

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        jobTitles: body.jobTitles || [],
        requiredSkills: body.requiredSkills || [],
        preferredSkills: body.preferredSkills || [],
        experienceYears: body.experienceYears ?? null,
        locations: body.locations || [],
        workModes: body.workModes || [],
        salaryMin: body.salaryMin ?? null,
        salaryMax: body.salaryMax ?? null,
        employmentTypes: body.employmentTypes || [],
        visaSponsorshipRequired: body.visaSponsorshipRequired ?? false,
        willingToRelocate: body.willingToRelocate ?? false,
        industries: body.industries || [],
        targetCompanies: body.targetCompanies || [],
        excludedCompanies: body.excludedCompanies || [],
        noticePeriodDays: body.noticePeriodDays ?? null,
        matchThreshold: body.matchThreshold ?? 70,
        preferencesComplete: complete,
        onboardingCompletedAt: complete ? new Date() : null,
        enabledSources: body.enabledSources || [
          "GREENHOUSE",
          "LEVER",
          "ASHBY",
          "WORKDAY",
        ],
      },
      update: {
        jobTitles: body.jobTitles,
        requiredSkills: body.requiredSkills,
        preferredSkills: body.preferredSkills,
        experienceYears: body.experienceYears,
        locations: body.locations,
        workModes: body.workModes,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        employmentTypes: body.employmentTypes,
        visaSponsorshipRequired: body.visaSponsorshipRequired,
        willingToRelocate: body.willingToRelocate,
        industries: body.industries,
        targetCompanies: body.targetCompanies,
        excludedCompanies: body.excludedCompanies,
        noticePeriodDays: body.noticePeriodDays,
        matchThreshold: body.matchThreshold,
        preferencesComplete: complete,
        onboardingCompletedAt: complete ? new Date() : undefined,
        enabledSources: body.enabledSources,
      },
    });

    if (complete) {
      await archiveLegacyJobs(user.id);
    }

    return NextResponse.json({ settings, validation: validateSearchPreferences(settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
