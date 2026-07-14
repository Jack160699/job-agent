import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser } from "@/lib/api/auth";
import {
  assessGoogleConnectionHealth,
  disconnectGoogle,
  getGrantedFeatures,
  getGoogleTokens,
  isGoogleConnected,
  syncIntegrationFlags,
} from "@/lib/google/oauth";
import { verifyGoogleApis, verifyGmailProfile } from "@/lib/google/verify";
import { syncGmail } from "@/lib/google/gmail";
import { syncApplicationsToSheet } from "@/lib/google/sheets";
import { syncInterviewsToCalendar } from "@/lib/google/calendar";
import { ensureDriveFolder } from "@/lib/google/drive";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveApiUser();
    const tokens = await getGoogleTokens(user.id);
    const connected = await isGoogleConnected(user.id);
    const health = assessGoogleConnectionHealth(tokens);
    const granted = await getGrantedFeatures(user.id);
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!connected) {
      return NextResponse.json({
        connected: false,
        health: "disconnected",
        email: null,
        grantedFeatures: [],
        integrations: {
          gmail: false,
          drive: false,
          sheets: false,
          calendar: false,
        },
      });
    }

    const verify = request.nextUrl.searchParams.get("verify") === "true";
    let email: string | null = null;
    let apis = null;

    if (verify) {
      apis = await verifyGoogleApis(user.id);
      email = apis.gmail.email || null;
    } else {
      try {
        email = (await verifyGmailProfile(user.id)) || user.email;
      } catch {
        email = user.email;
      }
    }

    return NextResponse.json({
      connected: true,
      health,
      email,
      grantedFeatures: granted,
      integrations: {
        gmail: settings?.gmailSyncEnabled ?? false,
        drive: settings?.driveBackupEnabled ?? false,
        sheets: settings?.sheetsSyncEnabled ?? false,
        calendar: settings?.calendarSyncEnabled ?? false,
      },
      apis,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveApiUser();
    const body = await request.json();
    const { action } = body;

    if (action === "disconnect") {
      await disconnectGoogle(user.id);
      await syncIntegrationFlags(user.id, [], { disableMissing: true });
      return NextResponse.json({ connected: false, health: "disconnected" });
    }

    if (action === "verify") {
      const apis = await verifyGoogleApis(user.id);
      return NextResponse.json({ connected: true, apis });
    }

    if (action === "sync") {
      const results: Record<string, unknown> = {};
      if (body.gmail) results.gmail = await syncGmail(user.id);
      if (body.sheets) results.sheets = await syncApplicationsToSheet(user.id);
      if (body.calendar) results.calendar = await syncInterviewsToCalendar(user.id);
      if (body.drive) results.drive = await ensureDriveFolder(user.id);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}
