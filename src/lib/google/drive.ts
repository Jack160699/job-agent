import { google } from "googleapis";
import { getAuthenticatedClient } from "./oauth";
import prisma from "@/lib/db";

export async function uploadToDrive(
  userId: string,
  fileName: string,
  content: Buffer,
  mimeType = "application/pdf"
) {
  const auth = await getAuthenticatedClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const folderId = settings?.driveFolderId || undefined;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: { mimeType, body: ReadableFromBuffer(content) },
    fields: "id, webViewLink",
  });

  return {
    fileId: res.data.id,
    webViewLink: res.data.webViewLink,
  };
}

export async function ensureDriveFolder(userId: string, folderName = "Kairela") {
  const auth = await getAuthenticatedClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const existing = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const folderId = folder.data.id!;
  await prisma.userSettings.update({
    where: { userId },
    data: { driveFolderId: folderId },
  });

  return folderId;
}

function ReadableFromBuffer(buffer: Buffer) {
  const { Readable } = require("stream") as typeof import("stream");
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}
