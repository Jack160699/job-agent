import { NextResponse } from "next/server";
import { resolveApiUserDev } from "@/lib/api/auth";
import { isGoogleConnected, disconnectGoogle } from "@/lib/google/oauth";
import { syncGmail } from "@/lib/google/gmail";
import { syncApplicationsToSheet } from "@/lib/google/sheets";
import { syncInterviewsToCalendar } from "@/lib/google/calendar";

export async function GET() {
  try {
    const user = await resolveApiUserDev();
    const connected = await isGoogleConnected(user.id);
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveApiUserDev();
    const body = await request.json();
    const { action } = body;

    if (action === "disconnect") {
      await disconnectGoogle(user.id);
      return NextResponse.json({ connected: false });
    }

    if (action === "sync") {
      const results: Record<string, unknown> = {};
      if (body.gmail) results.gmail = await syncGmail(user.id);
      if (body.sheets) results.sheets = await syncApplicationsToSheet(user.id);
      if (body.calendar) results.calendar = await syncInterviewsToCalendar(user.id);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
