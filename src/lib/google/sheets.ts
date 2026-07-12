import { google } from "googleapis";
import { getAuthenticatedClient } from "./oauth";
import prisma from "@/lib/db";

const HEADERS = [
  "Date",
  "Company",
  "Position",
  "Status",
  "Match Score",
  "Source",
  "URL",
];

export async function syncApplicationsToSheet(userId: string) {
  const auth = await getAuthenticatedClient(userId);
  const sheets = google.sheets({ version: "v4", auth });

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  let spreadsheetId = settings?.sheetsId;

  if (!spreadsheetId) {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: "Job Agent Applications" },
        sheets: [{ properties: { title: "Applications" } }],
      },
    });
    spreadsheetId = created.data.spreadsheetId!;
    await prisma.userSettings.update({
      where: { userId },
      data: { sheetsId: spreadsheetId, sheetsSyncEnabled: true },
    });
  }

  const applications = await prisma.application.findMany({
    where: { userId },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const rows = [
    HEADERS,
    ...applications.map((app) => [
      app.updatedAt.toISOString().split("T")[0],
      app.job.company,
      app.job.title,
      app.status,
      app.matchScore?.toFixed(1) || "",
      app.job.source,
      app.job.sourceUrl,
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Applications!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return { spreadsheetId, rows: applications.length };
}
