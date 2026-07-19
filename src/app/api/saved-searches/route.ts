import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { resolveApiUser } from "@/lib/api/auth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

const frequencySchema = z.enum(["OFF", "DAILY", "WEEKLY"]);
const stageSchema = z.enum(["strict", "balanced", "recovery"]);
const alertTypeSchema = z.enum([
  "new_high_match",
  "closing_soon",
  "government_deadline",
]);

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  alertFrequency: frequencySchema.default("OFF"),
  searchStage: stageSchema.default("strict"),
  alertTypes: z.array(alertTypeSchema).default(["new_high_match"]),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  alertFrequency: frequencySchema,
  alertTypes: z.array(alertTypeSchema).optional(),
});

function nextRunFor(frequency: "OFF" | "DAILY" | "WEEKLY", now = new Date()) {
  if (frequency === "OFF") return null;
  return new Date(
    now.getTime() +
      (frequency === "DAILY" ? 24 : 7 * 24) * 60 * 60 * 1000
  );
}

export async function GET() {
  try {
    const user = await resolveApiUser();
    const searches = await prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ searches });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load saved searches";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid saved search" },
        { status: 400 }
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    if (!settings?.preferencesComplete) {
      return NextResponse.json(
        { error: "Complete search preferences before saving this search." },
        { status: 422 }
      );
    }

    const frequency = parsed.data.alertFrequency;
    const search = await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        titles: settings.jobTitles,
        locations: settings.locations,
        sector: settings.sectorPreference,
        governmentCategories: settings.governmentCategories,
        filters: {
          workModes: settings.workModes,
          employmentTypes: settings.employmentTypes,
          experienceYears: settings.experienceYears,
          salaryMin: settings.salaryMin,
          salaryMax: settings.salaryMax,
          matchThreshold: settings.matchThreshold,
          industries: settings.industries,
          requiredSkills: settings.requiredSkills,
          preferredSkills: settings.preferredSkills,
          alertTypes: parsed.data.alertTypes,
        } as Prisma.InputJsonValue,
        searchStage: parsed.data.searchStage,
        sources: settings.enabledSources,
        alertFrequency: frequency,
        alertsEnabled: frequency !== "OFF",
        nextRunAt: nextRunFor(frequency),
      },
    });
    if (frequency !== "OFF" && !settings.notificationsEnabled) {
      await prisma.userSettings.update({
        where: { userId: user.id },
        data: { notificationsEnabled: true },
      });
    }
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save search";
    const duplicate = message.includes("Unique constraint");
    return NextResponse.json(
      {
        error: duplicate
          ? "A saved search with this name already exists."
          : message,
      },
      { status: message === "Unauthorized" ? 401 : duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid alert settings" },
        { status: 400 }
      );
    }
    const existing = await prisma.savedSearch.findFirst({
      where: { id: parsed.data.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Saved search not found." }, { status: 404 });
    }
    const existingFilters = (existing.filters ?? {}) as Record<string, unknown>;
    const frequency = parsed.data.alertFrequency;
    const search = await prisma.savedSearch.update({
      where: { id: existing.id },
      data: {
        alertFrequency: frequency,
        alertsEnabled: frequency !== "OFF",
        nextRunAt: nextRunFor(frequency),
        filters: {
          ...existingFilters,
          ...(parsed.data.alertTypes
            ? { alertTypes: parsed.data.alertTypes }
            : {}),
        } as Prisma.InputJsonValue,
      },
    });
    if (frequency !== "OFF") {
      await prisma.userSettings.update({
        where: { userId: user.id },
        data: { notificationsEnabled: true },
      });
    }
    return NextResponse.json({ search });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update alert";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Saved search id is required." }, { status: 400 });
    }
    const deleted = await prisma.savedSearch.deleteMany({
      where: { id, userId: user.id },
    });
    return NextResponse.json({ deleted: deleted.count > 0 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete saved search";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
