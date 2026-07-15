import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog, prisma } from "@/lib/api/auth";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

const settingsSchema = z
  .object({
    jobTitles: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    locations: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    experienceYears: z.number().int().min(0).max(80).nullable().optional(),
    salaryMin: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    salaryMax: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    matchThreshold: z.number().min(0).max(100).optional(),
    requireReview: z.boolean().optional(),
    autoSubmitEnabled: z.boolean().optional(),
    targetCompanies: z
      .array(z.string().trim().min(1).max(120))
      .max(100)
      .optional(),
    gmailSyncEnabled: z.boolean().optional(),
    sheetsSyncEnabled: z.boolean().optional(),
    calendarSyncEnabled: z.boolean().optional(),
    driveBackupEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    quietHoursStart: timeSchema.optional(),
    quietHoursEnd: timeSchema.optional(),
    proactiveFrequencyHours: z.number().int().min(6).max(168).optional(),
    disabledRecommendationCategories: z
      .array(
        z.enum([
          "profile",
          "search",
          "matches",
          "applications",
          "communication",
          "interviews",
          "integrations",
          "account",
        ])
      )
      .max(8)
      .optional(),
    dailyDigestEnabled: z.boolean().optional(),
    weeklyReportEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMin <= data.salaryMax,
    {
      message: "Minimum salary cannot be greater than maximum salary.",
      path: ["salaryMin"],
    }
  );

export async function GET() {
  try {
    const user = await resolveApiUser();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Check the settings values and try again.",
        },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        jobTitles: body.jobTitles ?? [],
        locations: body.locations ?? [],
        workModes: [],
        requiredSkills: [],
        preferredSkills: [],
        companySizes: [],
        employmentTypes: [],
        autoSubmitSources: [],
        enabledSources: [],
        ...body,
      },
      update: body,
    });

    await createAuditLog({
      userId: user.id,
      action: "SETTINGS_UPDATED",
      message: "User settings updated",
      level: "AUDIT",
    });

    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
