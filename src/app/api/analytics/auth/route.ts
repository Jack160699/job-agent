import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { createAuditLog } from "@/lib/audit";
import { getDbUser } from "@/lib/auth/server";
import { AUTH_ANALYTICS_EVENTS, sanitizeAnalyticsMetadata } from "@/lib/analytics/events";

/**
 * Auth-flow analytics can legitimately fire before a session exists (e.g.
 * linkedin_auth_started, on the login page). Unlike /api/analytics/onboarding
 * this endpoint does not require authentication — it resolves a user when
 * one is available and otherwise logs without a userId.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const body = await request.json();
    const event = body?.event as string | undefined;

    if (!event || !AUTH_ANALYTICS_EVENTS.includes(event as never)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }

    const user = await getDbUser();

    await createAuditLog({
      userId: user?.id,
      level: "INFO",
      action: `analytics:${event}`,
      resource: "auth",
      message: event,
      metadata: sanitizeAnalyticsMetadata(body?.metadata),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
