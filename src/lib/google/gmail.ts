import { google } from "googleapis";
import { getAuthenticatedClient } from "./oauth";

export async function syncGmail(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: "subject:(interview OR offer OR application OR recruiter) newer_than:30d",
    maxResults: 20,
  });

  const messages = list.data.messages || [];
  let synced = 0;

  for (const msg of messages) {
    if (!msg.id) continue;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = full.data.payload?.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const to = headers.find((h) => h.name === "To")?.value || "";
    const dateHeader = headers.find((h) => h.name === "Date")?.value;
    const body =
      full.data.snippet ||
      extractBody(full.data.payload) ||
      "";

    const msgId = msg.id;
    if (!msgId) continue;

    const existing = await import("@/lib/db").then((m) =>
      m.default.email.findUnique({ where: { gmailId: msgId } })
    );
    if (existing) continue;

    await import("@/lib/db").then((m) =>
      m.default.email.create({
        data: {
          userId,
          gmailId: msgId,
          threadId: full.data.threadId || undefined,
          direction: from.includes("me") ? "OUTBOUND" : "INBOUND",
          fromAddress: from,
          toAddress: to,
          subject,
          body,
          receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
        },
      })
    );
    synced++;
  }

  return { synced, total: messages.length };
}

function extractBody(payload: unknown): string {
  const p = payload as {
    body?: { data?: string | null };
    parts?: Array<{ body?: { data?: string | null }; mimeType?: string }>;
  } | null;
  if (!p) return "";
  if (p.body?.data) {
    return Buffer.from(p.body.data, "base64").toString("utf8");
  }
  for (const part of p.parts || []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf8");
    }
  }
  return "";
}
