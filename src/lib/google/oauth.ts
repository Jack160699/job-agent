import { google } from "googleapis";
import prisma from "@/lib/db";
import { encrypt, decrypt } from "@/lib/security/encryption";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
];

const TOKEN_KEY = "google_oauth_tokens";

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(userId: string) {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: userId,
  });
}

export async function storeGoogleTokens(userId: string, tokens: object) {
  const value = encrypt(JSON.stringify(tokens));
  await prisma.encryptedSecret.upsert({
    where: { userId_key: { userId, key: TOKEN_KEY } },
    create: { userId, key: TOKEN_KEY, value },
    update: { value },
  });
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
  };
}

export async function getAuthenticatedClient(userId: string) {
  const client = getGoogleOAuthClient();
  const tokens = await getGoogleTokens(userId);
  if (!tokens) throw new Error("Google not connected");

  client.setCredentials(tokens);

  client.on("tokens", async (newTokens) => {
    await storeGoogleTokens(userId, { ...tokens, ...newTokens });
  });

  return client;
}

export async function isGoogleConnected(userId: string) {
  const tokens = await getGoogleTokens(userId);
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

export async function disconnectGoogle(userId: string) {
  await prisma.encryptedSecret.deleteMany({
    where: { userId, key: TOKEN_KEY },
  });
}
