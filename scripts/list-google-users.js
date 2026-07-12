require("dotenv").config({ path: ".env.production" });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany({
    select: {
      id: true,
      email: true,
      settings: {
        select: {
          gmailSyncEnabled: true,
          sheetsSyncEnabled: true,
          calendarSyncEnabled: true,
        },
      },
    },
  });

  for (const user of users) {
    const secret = await p.encryptedSecret.findUnique({
      where: { userId_key: { userId: user.id, key: "google_oauth_tokens" } },
    });
    console.log(
      JSON.stringify({
        email: user.email,
        id: user.id,
        hasTokens: Boolean(secret),
        settings: user.settings,
      })
    );
  }
}

main().finally(() => p.$disconnect());
