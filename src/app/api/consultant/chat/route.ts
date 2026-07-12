import { NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import { chatWithConsultant } from "@/lib/consultant/service";
import { isFeatureEnabled } from "@/lib/feature-flags";

export async function POST(request: Request) {
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Consultant unavailable";
    return NextResponse.json({ error: msg }, { status: 429 });
  }
}

export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { default: prisma } = await import("@/lib/db");
  const messages = await prisma.consultantMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({ messages, enabled: isFeatureEnabled("aiConsultant") });
}
