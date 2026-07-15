import { google } from "googleapis";
import {
  getAuthenticatedClient,
  type GoogleIntegrationFeature,
} from "./oauth";

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

export async function verifyGoogleApis(
  userId: string,
  features: GoogleIntegrationFeature[]
): Promise<GoogleApiVerification> {
  const auth = await getAuthenticatedClient(userId);
  const results: GoogleApiVerification = {
    gmail: { ok: false },
    drive: { ok: false },
    sheets: { ok: false },
    calendar: { ok: false },
  };

  if (features.includes("gmail")) try {
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    results.gmail = { ok: true, email: profile.data.emailAddress || undefined };
  } catch (error) {
    results.gmail = {
      ok: false,
      error: error instanceof Error ? error.message : "Gmail check failed",
    };
  }

  if (features.includes("drive")) try {
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

  if (features.includes("sheets")) try {
    const access = await auth.getAccessToken();
    if (!access.token) throw new Error("Google access token unavailable");
    const tokenInfo = await auth.getTokenInfo(access.token);
    results.sheets = {
      ok: tokenInfo.scopes.includes(
        "https://www.googleapis.com/auth/spreadsheets"
      ),
    };
  } catch (error) {
    results.sheets = {
      ok: false,
      error: error instanceof Error ? error.message : "Sheets check failed",
    };
  }

  if (features.includes("calendar")) try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.list({ calendarId: "primary", maxResults: 1 });
    results.calendar = { ok: true };
  } catch (error) {
    results.calendar = {
      ok: false,
      error: error instanceof Error ? error.message : "Calendar check failed",
    };
  }

  return results;
}
