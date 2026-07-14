import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import { chatWithConsultant } from "@/lib/consultant/service";
import { pageSuggestions } from "@/lib/agent/context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.aiChat,
    keyPrefix: "consultant-chat",
  });
  if (limited) return limited;

  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFeatureEnabled("aiConsultant")) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
  }

  const body = await request.json();
  const message = (body.message as string)?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  try {
    const result = await chatWithConsultant(user.id, message, {
      pathname: body.pathname,
      pageTitle: body.pageTitle,
    });
    return NextResponse.json({
      reply: result.message.content,
      remaining: result.remaining,
      suggestions: result.suggestions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Consultant unavailable";
    return NextResponse.json({ error: msg }, { status: 429 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname") ?? undefined;

  const { default: prisma } = await import("@/lib/db");
  const messages = await prisma.consultantMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({
    messages,
    enabled: isFeatureEnabled("aiConsultant"),
    suggestions: pageSuggestions(pathname),
  });
}