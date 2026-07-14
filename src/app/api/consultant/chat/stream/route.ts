import { NextRequest } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import { streamConsultantReply } from "@/lib/consultant/service";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.aiChat,
    keyPrefix: "consultant-stream",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!isFeatureEnabled("aiConsultant")) {
    return new Response(JSON.stringify({ error: "Feature disabled" }), { status: 403 });
  }

  const body = await request.json();
  const message = (body.message as string)?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "Message required" }), { status: 400 });
  }

  try {
    const { stream } = await streamConsultantReply(user.id, message, {
      pathname: body.pathname,
      pageTitle: body.pageTitle,
    });
    return stream.toDataStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Consultant unavailable";
    return new Response(JSON.stringify({ error: msg }), {
      status: msg.includes("limit") ? 429 : 500,
    });
  }
}
