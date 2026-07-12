import { google } from "googleapis";
import prisma from "@/lib/db";
import { encrypt, decrypt } from "@/lib/security/encryption";
import { getGoogleOAuthRedirectUri } from "@/lib/brand/urls";

/** Identity-only scopes are handled by Supabase Auth — not this module. */
export const GOOGLE_INTEGRATION_SCOPES = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  drive: ["https://www.googleapis.com/auth/drive.file"],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
} as const;

export type GoogleIntegrationFeature = keyof typeof GOOGLE_INTEGRATION_SCOPES;

const TOKEN_KEY = "google_oauth_tokens";
const SCOPES_KEY = "google_oauth_scopes";

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleOAuthRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function scopesForFeatures(features: GoogleIntegrationFeature[]): string[] {
  const scopes = new Set<string>();
  for (const f of features) {
    for (const s of GOOGLE_INTEGRATION_SCOPES[f]) scopes.add(s);
  }
  return [...scopes];
}

export function getAuthUrl(userId: string, features: GoogleIntegrationFeature[]) {
  const scopes = scopesForFeatures(features);
  if (scopes.length === 0) {
    throw new Error("Select at least one integration to connect");
  }

  const client = getGoogleOAuthClient();
  const state = Buffer.from(
    JSON.stringify({ userId, features })
  ).toString("base64url");

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}

export async function storeGoogleTokens(
  userId: string,
  tokens: object,
  features: GoogleIntegrationFeature[]
) {
  const value = encrypt(JSON.stringify(tokens));
  await prisma.encryptedSecret.upsert({
    where: { userId_key: { userId, key: TOKEN_KEY } },
    create: { userId, key: TOKEN_KEY, value },
    update: { value },
  });
  await prisma.encryptedSecret.upsert({
    where: { userId_key: { userId, key: SCOPES_KEY } },
    create: {
      userId,
      key: SCOPES_KEY,
      value: encrypt(JSON.stringify(features)),
    },
    update: { value: encrypt(JSON.stringify(features)) },
  });
}

export async function getGrantedFeatures(
  userId: string
): Promise<GoogleIntegrationFeature[]> {
  const secret = await prisma.encryptedSecret.findUnique({
    where: { userId_key: { userId, key: SCOPES_KEY } },
  });
  if (!secret) return [];
  try {
    return JSON.parse(decrypt(secret.value)) as GoogleIntegrationFeature[];
  } catch {
    return [];
  }
}

export async function getGoogleTokens(userId: string) {
  const secret = await prisma.encryptedSecret.findUnique({
    where: { userId_key: { userId, key: TOKEN_KEY } },
  });
  if (!secret) return null;
  return JSON.parse(decrypt(secret.value)) as {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
    scope?: string;
  };
}

export async function getAuthenticatedClient(userId: string) {
  const client = getGoogleOAuthClient();
  const tokens = await getGoogleTokens(userId);
  if (!tokens) throw new Error("Google not connected");

  client.setCredentials(tokens);

  client.on("tokens", async (newTokens) => {
    await storeGoogleTokens(userId, { ...tokens, ...newTokens }, await getGrantedFeatures(userId));
  });

  return client;
}

export async function isGoogleConnected(userId: string) {
  const tokens = await getGoogleTokens(userId);
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

export async function disconnectGoogle(userId: string) {
  await prisma.encryptedSecret.deleteMany({
    where: { userId, key: { in: [TOKEN_KEY, SCOPES_KEY] } },
  });
}

/** Enable only the integrations the user explicitly authorized. */
export async function syncIntegrationFlags(
  userId: string,
  features: GoogleIntegrationFeature[]
) {
  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      jobTitles: [],
      locations: [],
      gmailSyncEnabled: features.includes("gmail"),
      sheetsSyncEnabled: features.includes("sheets"),
      calendarSyncEnabled: features.includes("calendar"),
      driveBackupEnabled: features.includes("drive"),
    },
    update: {
      gmailSyncEnabled: features.includes("gmail"),
      sheetsSyncEnabled: features.includes("sheets"),
      calendarSyncEnabled: features.includes("calendar"),
      driveBackupEnabled: features.includes("drive"),
    },
  });
}
