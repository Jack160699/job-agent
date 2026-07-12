require("dotenv").config({ path: ".env.production" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");
const crypto = require("crypto");

const p = new PrismaClient();

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY missing");
  return crypto.scryptSync(key, "job-agent-salt", 32);
}

function decrypt(ciphertext) {
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function main() {
  const email = process.argv[2] || "jobagent.test.2026@gmail.com";
  const user = await p.user.findFirst({
    where: { email },
    include: { settings: true },
  });
  if (!user) {
    console.log("User not found:", email);
    return;
  }

  const secret = await p.encryptedSecret.findUnique({
    where: { userId_key: { userId: user.id, key: "google_oauth_tokens" } },
  });

  console.log("User:", user.id, user.email);
  console.log("Settings:", {
    gmail: user.settings?.gmailSyncEnabled,
    sheets: user.settings?.sheetsSyncEnabled,
    calendar: user.settings?.calendarSyncEnabled,
    driveFolderId: user.settings?.driveFolderId,
    sheetsId: user.settings?.sheetsId,
  });
  console.log("Has token secret:", Boolean(secret));

  if (!secret) return;

  const tokens = JSON.parse(decrypt(secret.value));
  console.log("Token keys:", Object.keys(tokens));
  console.log("Has refresh_token:", Boolean(tokens.refresh_token));
  console.log("Has access_token:", Boolean(tokens.access_token));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`;

  if (!clientId || !clientSecret) {
    console.log("Google OAuth env not set locally");
    return;
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials(tokens);

  try {
    const gmail = google.gmail({ version: "v1", auth: client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("Gmail profile:", profile.data.emailAddress);
  } catch (e) {
    console.log("Gmail error:", e.message);
  }
}

main().finally(() => p.$disconnect());
