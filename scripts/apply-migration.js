const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("fs");
const { resolve } = require("path");
const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe(
    "ALTER TYPE job_source ADD VALUE IF NOT EXISTS 'WORKDAY'"
  );
  await p.$executeRawUnsafe(
    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS target_companies TEXT[] DEFAULT '{}'"
  );

  const browserSql = readFileSync(
    resolve(__dirname, "../supabase/migrations/20260712160000_browser_tasks.sql"),
    "utf8"
  );
  for (const statement of browserSql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await p.$executeRawUnsafe(statement);
  }

  console.log("Migration applied");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
