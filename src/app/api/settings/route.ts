import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import prisma from "@/lib/db";
import { getOrCreateUser } from "@/lib/jobs/pipeline";
import { createAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const settings = await prisma.userSettings.findFirst();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(null);
  }
}

export async function PUT(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string;
    if (user) {
      const dbUser = await getOrCreateUser(user.id, user.email!);
      userId = dbUser.id;
    } else if (process.env.NODE_ENV === "development") {
      const dbUser = await getOrCreateUser("dev-user", "dev@localhost");
      userId = dbUser.id;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });

    await createAuditLog({
      userId,
      action: "SETTINGS_UPDATED",
      message: "User settings updated",
      level: "AUDIT",
    });

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
