import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { resolveApiUserDev, createAuditLog, prisma } from "@/lib/api/auth";

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(null);
  }
}

export async function PUT(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT_PRESETS.default);
  if (limited) return limited;

  try {
    const user = await resolveApiUserDev();
    const body = await request.json();

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
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
