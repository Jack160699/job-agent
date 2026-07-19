import { NextRequest, NextResponse } from "next/server";
import type { JobSource } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveApiUser } from "@/lib/api/auth";
import {
  AshbyAdapter,
  GreenhouseAdapter,
  LeverAdapter,
  WorkdayAdapter,
} from "@/lib/jobs/adapters";
import { getOfficialGovernmentAdapters } from "@/lib/jobs/government-adapters";
import { buildDiscoveryBoards } from "@/lib/jobs/preferences";
import { buildUserSearchPlan } from "@/lib/jobs/search-plan";
import { SOURCE_CAPABILITIES } from "@/lib/jobs/source-capabilities";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export const maxDuration = 30;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Connection test timed out")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.jobSearch);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = (await request.json()) as { source?: string };
    if (!body.source || !(body.source in SOURCE_CAPABILITIES)) {
      return NextResponse.json({ error: "INVALID_SOURCE" }, { status: 400 });
    }

    const source = body.source as JobSource;
    const capability = SOURCE_CAPABILITIES[source];
    if (!capability.searchable) {
      return NextResponse.json(
        {
          error: capability.status,
          message: capability.explanation,
        },
        { status: 409 }
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    if (!settings) {
      return NextResponse.json(
        { error: "SETTINGS_NOT_FOUND" },
        { status: 404 }
      );
    }

    const plan = buildUserSearchPlan(settings);
    const adapters = [
      new GreenhouseAdapter(),
      new LeverAdapter(),
      new AshbyAdapter(),
      new WorkdayAdapter(),
      ...getOfficialGovernmentAdapters(),
    ];
    const adapter = adapters.find((item) => item.source === source);
    if (!adapter) {
      return NextResponse.json(
        { error: "ADAPTER_NOT_CONFIGURED" },
        { status: 409 }
      );
    }

    const startedAt = Date.now();
    const jobs = await withTimeout(
      adapter.search({
        titles: plan.primaryRoles,
        queries: plan.queries.slice(0, 3),
        locations: settings.locations,
        remote: settings.workModes.includes("REMOTE"),
        experienceYears: settings.experienceYears ?? undefined,
        skills: settings.requiredSkills,
        discoveryBoards: buildDiscoveryBoards(settings),
      }),
      20_000
    );

    return NextResponse.json({
      source,
      jobs: jobs.length,
      durationMs: Date.now() - startedAt,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json(
      { error: "SOURCE_TEST_FAILED", message },
      { status: message === "Unauthorized" ? 401 : 502 }
    );
  }
}
