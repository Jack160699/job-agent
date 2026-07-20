import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDbUser } from "@/lib/auth/server";
import {
  generateProactiveRecommendations,
  getActiveRecommendations,
} from "@/lib/proactive/service";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import prisma from "@/lib/db";

const categorySchema = z.enum([
  "profile",
  "search",
  "matches",
  "applications",
  "communication",
  "interviews",
  "integrations",
  "account",
]);

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismiss"), id: z.string().uuid() }),
  z.object({
    action: z.literal("snooze"),
    id: z.string().uuid(),
    hours: z.number().int().min(1).max(24 * 30).default(24),
  }),
  z.object({ action: z.literal("done"), id: z.string().uuid() }),
  z.object({
    action: z.literal("disable_category"),
    category: categorySchema,
  }),
  z.object({
    action: z.literal("enable_category"),
    category: categorySchema,
  }),
  z.object({
    action: z.literal("configure"),
    notificationsEnabled: z.boolean().optional(),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    proactiveFrequencyHours: z.number().int().min(6).max(168).optional(),
    dailyDigestEnabled: z.boolean().optional(),
    weeklyReportEnabled: z.boolean().optional(),
  }),
]);

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.default,
    keyPrefix: "recommendations",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await generateProactiveRecommendations(user.id);
  const [recommendations, settings] = await Promise.all([
    getActiveRecommendations(user.id),
    prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: {
        notificationsEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        proactiveFrequencyHours: true,
        disabledRecommendationCategories: true,
        dailyDigestEnabled: true,
        weeklyReportEnabled: true,
      },
    }),
  ]);
  if (!settings) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ recommendations, settings });
}

export async function PATCH(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.default,
    keyPrefix: "recommendation-actions",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recommendation action." },
      { status: 400 }
    );
  }

  const body = parsed.data;

  if (
    body.action === "disable_category" ||
    body.action === "enable_category"
  ) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { disabledRecommendationCategories: true },
    });
    if (!settings) {
      return NextResponse.json(
        { error: "Complete onboarding before changing recommendation settings." },
        { status: 409 }
      );
    }
    const categories = new Set(settings.disabledRecommendationCategories);
    if (body.action === "disable_category") categories.add(body.category);
    else categories.delete(body.category);
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { disabledRecommendationCategories: [...categories] },
    });
    if (body.action === "disable_category") {
      await prisma.proactiveRecommendation.updateMany({
        where: {
          userId: user.id,
          category: body.category,
          status: { in: ["active", "snoozed"] },
        },
        data: { status: "dismissed", dismissed: true },
      });
    }
    return NextResponse.json({ ok: true, disabledCategories: [...categories] });
  }

  if (body.action === "configure") {
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        notificationsEnabled: body.notificationsEnabled,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        proactiveFrequencyHours: body.proactiveFrequencyHours,
        dailyDigestEnabled: body.dailyDigestEnabled,
        weeklyReportEnabled: body.weeklyReportEnabled,
      },
    });
    return NextResponse.json({ ok: true });
  }

  const rec = await prisma.proactiveRecommendation.findFirst({
    where: { id: body.id, userId: user.id },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.action === "dismiss") {
    await prisma.proactiveRecommendation.update({
      where: { id: body.id },
      data: { dismissed: true, status: "dismissed" },
    });
  } else if (body.action === "snooze") {
    await prisma.proactiveRecommendation.update({
      where: { id: body.id },
      data: {
        status: "snoozed",
        snoozedUntil: new Date(Date.now() + body.hours * 60 * 60 * 1000),
      },
    });
  } else {
    await prisma.proactiveRecommendation.update({
      where: { id: body.id },
      data: {
        status: "done",
        completedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
