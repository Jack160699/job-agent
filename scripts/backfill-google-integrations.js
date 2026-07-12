require("dotenv").config({ path: ".env.production" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();

async function main() {
  const userId = process.argv[2] || "b9f9a0df-0a48-438c-bb05-2fb727c74b9e";
  await p.userSettings.update({
    where: { userId },
    data: {
      gmailSyncEnabled: true,
      sheetsSyncEnabled: true,
      calendarSyncEnabled: true,
    },
  });
  console.log("Backfilled integration toggles for", userId);
}

main().finally(() => p.$disconnect());
