import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUser, createAuditLog } from "@/lib/api/auth";
import { ONBOARDING_ANALYTICS_EVENTS, sanitizeAnalyticsMetadata } from "@/lib/analytics/events";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const body = await request.json();
    const event = body?.event as string | undefined;

    if (!event || !ONBOARDING_ANALYTICS_EVENTS.includes(event as never)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
    }

    await createAuditLog({
      userId: user.id,
      level: "INFO",
      action: `analytics:${event}`,
      resource: "onboarding",
      message: event,
      metadata: sanitizeAnalyticsMetadata(body?.metadata),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
