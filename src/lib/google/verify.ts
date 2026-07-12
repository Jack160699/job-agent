import { google } from "googleapis";
import { getAuthenticatedClient } from "./oauth";

export type GoogleApiVerification = {
  gmail: { ok: boolean; email?: string; error?: string };
  drive: { ok: boolean; email?: string; error?: string };
  sheets: { ok: boolean; error?: string };
  calendar: { ok: boolean; error?: string };
};

export async function verifyGmailProfile(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress || null;
}

export async function verifyGoogleApis(userId: string): Promise<GoogleApiVerification> {
  const auth = await getAuthenticatedClient(userId);
  const results: GoogleApiVerification = {
    gmail: { ok: false },
    drive: { ok: false },
    sheets: { ok: false },
    calendar: { ok: false },
  };

  try {
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    results.gmail = { ok: true, email: profile.data.emailAddress || undefined };
  } catch (error) {
    results.gmail = {
      ok: false,
      error: error instanceof Error ? error.message : "Gmail check failed",
    };
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    results.drive = {
      ok: true,
      email: about.data.user?.emailAddress || undefined,
    };
  } catch (error) {
    results.drive = {
      ok: false,
      error: error instanceof Error ? error.message : "Drive check failed",
    };
  }

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Job Agent Connection Test" },
        sheets: [{ properties: { title: "Test" } }],
      },
    });
    if (created.data.spreadsheetId) {
      const drive = google.drive({ version: "v3", auth });
      await drive.files.delete({ fileId: created.data.spreadsheetId });
    }
    results.sheets = { ok: true };
  } catch (error) {
    results.sheets = {
      ok: false,
      error: error instanceof Error ? error.message : "Sheets check failed",
    };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.calendarList.list({ maxResults: 1 });
    results.calendar = { ok: true };
  } catch (error) {
    results.calendar = {
      ok: false,
      error: error instanceof Error ? error.message : "Calendar check failed",
    };
  }

  return results;
}
