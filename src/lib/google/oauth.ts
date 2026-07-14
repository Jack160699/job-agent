import { google } from "googleapis";
import prisma from "@/lib/db";
import { encrypt, decrypt } from "@/lib/security/encryption";
import { createSignedOAuthState } from "@/lib/security/oauth-state";
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

export const GOOGLE_INTEGRATION_FEATURES = Object.keys(
  GOOGLE_INTEGRATION_SCOPES
) as GoogleIntegrationFeature[];

export type GoogleConnectionHealth =
  | "disconnected"
  | "healthy"
  | "expired"
  | "missing_refresh_token"
  | "error";

export type GoogleTokenBundle = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
  id_token?: string | null;
};

const TOKEN_KEY = "google_oauth_tokens";
const SCOPES_KEY = "google_oauth_scopes";

export function isGoogleIntegrationFeature(
  value: string
): value is GoogleIntegrationFeature {
  return (GOOGLE_INTEGRATION_FEATURES as string[]).includes(value);
}

export function parseGoogleFeatures(
  values: string[]
): GoogleIntegrationFeature[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const invalid = unique.filter((value) => !isGoogleIntegrationFeature(value));
  if (invalid.length > 0) {
    throw new Error(`Invalid Google integration features: ${invalid.join(", ")}`);
  }
  return unique as GoogleIntegrationFeature[];
}

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
  const scoped = parseGoogleFeatures(features);
  const scopes = scopesForFeatures(scoped);
  if (scopes.length === 0) {
    throw new Error("Select at least one integration to connect");
  }

  const client = getGoogleOAuthClient();
  const state = createSignedOAuthState({ userId, features: scoped });

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}

export function mergeGoogleTokens(
  existing: GoogleTokenBundle | null | undefined,
  incoming: GoogleTokenBundle
): GoogleTokenBundle {
  return {
    ...(existing || {}),
    ...incoming,
    refresh_token:
      incoming.refresh_token || existing?.refresh_token || null,
  };
}

export function unionGoogleFeatures(
  existing: GoogleIntegrationFeature[],
  incoming: GoogleIntegrationFeature[]
): GoogleIntegrationFeature[] {
  return [...new Set([...existing, ...incoming])];
}

export async function storeGoogleTokens(
  userId: string,
  tokens: GoogleTokenBundle,
  features: GoogleIntegrationFeature[],
  options?: { mergeExisting?: boolean }
) {
  const mergeExisting = options?.mergeExisting !== false;
  const existingTokens = mergeExisting ? await getGoogleTokens(userId) : null;
  const existingFeatures = mergeExisting
    ? await getGrantedFeatures(userId)
    : [];
  const mergedTokens = mergeGoogleTokens(existingTokens, tokens);
  const mergedFeatures = unionGoogleFeatures(existingFeatures, features);

  const value = encrypt(JSON.stringify(mergedTokens));
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
      value: encrypt(JSON.stringify(mergedFeatures)),
    },
    update: { value: encrypt(JSON.stringify(mergedFeatures)) },
  });

  return { tokens: mergedTokens, features: mergedFeatures };
}

export async function getGrantedFeatures(
  userId: string
): Promise<GoogleIntegrationFeature[]> {
  const secret = await prisma.encryptedSecret.findUnique({
    where: { userId_key: { userId, key: SCOPES_KEY } },
  });
  if (!secret) return [];
  try {
    const parsed = JSON.parse(decrypt(secret.value)) as string[];
    return parseGoogleFeatures(parsed);
  } catch {
    return [];
  }
}

export async function getGoogleTokens(
  userId: string
): Promise<GoogleTokenBundle | null> {
  const secret = await prisma.encryptedSecret.findUnique({
    where: { userId_key: { userId, key: TOKEN_KEY } },
  });
  if (!secret) return null;
  return JSON.parse(decrypt(secret.value)) as GoogleTokenBundle;
}

export function assessGoogleConnectionHealth(
  tokens: GoogleTokenBundle | null
): GoogleConnectionHealth {
  if (!tokens) return "disconnected";
  if (!tokens.refresh_token && !tokens.access_token) return "disconnected";
  if (!tokens.refresh_token) return "missing_refresh_token";
  if (
    tokens.expiry_date &&
    tokens.expiry_date < Date.now() &&
    !tokens.refresh_token
  ) {
    return "expired";
  }
  return "healthy";
}

export async function getAuthenticatedClient(userId: string) {
  const client = getGoogleOAuthClient();
  const tokens = await getGoogleTokens(userId);
  if (!tokens) throw new Error("Google not connected");

  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    id_token: tokens.id_token ?? undefined,
  });

  client.on("tokens", async (newTokens) => {
    await storeGoogleTokens(
      userId,
      newTokens as GoogleTokenBundle,
      await getGrantedFeatures(userId)
    );
  });

  return client;
}

export async function isGoogleConnected(userId: string) {
  const tokens = await getGoogleTokens(userId);
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

export async function revokeGoogleAccess(userId: string) {
  const tokens = await getGoogleTokens(userId);
  const token = tokens?.refresh_token || tokens?.access_token;
  if (!token) return { revoked: false as const, reason: "missing_token" };

  try {
    const client = getGoogleOAuthClient();
    await client.revokeToken(token);
    return { revoked: true as const };
  } catch (error) {
    return {
      revoked: false as const,
      reason: error instanceof Error ? error.message : "revoke_failed",
    };
  }
}

export async function disconnectGoogle(userId: string) {
  const revoke = await revokeGoogleAccess(userId);
  await prisma.encryptedSecret.deleteMany({
    where: { userId, key: { in: [TOKEN_KEY, SCOPES_KEY] } },
  });
  return revoke;
}

/** Enable the integrations the user authorized, preserving previously granted ones. */
export async function syncIntegrationFlags(
  userId: string,
  features: GoogleIntegrationFeature[],
  options?: { disableMissing?: boolean }
) {
  const disableMissing = options?.disableMissing === true;
  const data = {
    gmailSyncEnabled: features.includes("gmail"),
    sheetsSyncEnabled: features.includes("sheets"),
    calendarSyncEnabled: features.includes("calendar"),
    driveBackupEnabled: features.includes("drive"),
  };

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      jobTitles: [],
      locations: [],
      ...data,
    },
    update: disableMissing
      ? data
      : {
          ...(features.includes("gmail") ? { gmailSyncEnabled: true } : {}),
          ...(features.includes("sheets") ? { sheetsSyncEnabled: true } : {}),
          ...(features.includes("calendar")
            ? { calendarSyncEnabled: true }
            : {}),
          ...(features.includes("drive") ? { driveBackupEnabled: true } : {}),
        },
  });
}
