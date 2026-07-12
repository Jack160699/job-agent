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
  const email = process.argv[2] || "stratxcelgame@gmail.com";
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
  });
  console.log("Has token secret:", Boolean(secret));

  if (!secret) return;

  const tokens = JSON.parse(decrypt(secret.value));
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);

  const auth = client;
  const results = {};

  try {
    const gmail = google.gmail({ version: "v1", auth });
    const profile = await gmail.users.getProfile({ userId: "me" });
    results.gmail = { ok: true, email: profile.data.emailAddress };
  } catch (e) {
    results.gmail = { ok: false, error: e.message };
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    results.drive = { ok: true, email: about.data.user?.emailAddress };
  } catch (e) {
    results.drive = { ok: false, error: e.message };
  }

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Job Agent API Test" },
        sheets: [{ properties: { title: "Test" } }],
      },
    });
    if (created.data.spreadsheetId) {
      const drive = google.drive({ version: "v3", auth });
      await drive.files.delete({ fileId: created.data.spreadsheetId });
    }
    results.sheets = { ok: true };
  } catch (e) {
    results.sheets = { ok: false, error: e.message };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.calendarList.list({ maxResults: 1 });
    results.calendar = { ok: true };
  } catch (e) {
    results.calendar = { ok: false, error: e.message };
  }

  console.log("API verification:", JSON.stringify(results, null, 2));

  await p.userSettings.update({
    where: { userId: user.id },
    data: {
      gmailSyncEnabled: true,
      sheetsSyncEnabled: true,
      calendarSyncEnabled: true,
    },
  });
  console.log("Integration toggles enabled in database.");
}

main().finally(() => p.$disconnect());
