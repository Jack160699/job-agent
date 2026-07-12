import { NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import {
  generateProactiveRecommendations,
  getActiveRecommendations,
} from "@/lib/proactive/service";

export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await generateProactiveRecommendations(user.id);
  const recommendations = await getActiveRecommendations(user.id);
  return NextResponse.json({ recommendations });
}

export async function PATCH(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const id = body.id as string;
  const action = body.action as "dismiss" | "snooze";

  const { default: prisma } = await import("@/lib/db");
  const rec = await prisma.proactiveRecommendation.findFirst({
    where: { id, userId: user.id },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "dismiss") {
    await prisma.proactiveRecommendation.update({
      where: { id },
      data: { dismissed: true },
    });
  } else if (action === "snooze") {
    const hours = (body.hours as number) || 24;
    await prisma.proactiveRecommendation.update({
      where: { id },
      data: { snoozedUntil: new Date(Date.now() + hours * 60 * 60 * 1000) },
    });
  }

  return NextResponse.json({ ok: true });
}
