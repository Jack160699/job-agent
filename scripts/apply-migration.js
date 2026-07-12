const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  await p.$executeRawUnsafe(
    "ALTER TYPE job_source ADD VALUE IF NOT EXISTS 'WORKDAY'"
  );
  await p.$executeRawUnsafe(
    "ALTER TABLE settings ADD COLUMN IF NOT EXISTS target_companies TEXT[] DEFAULT '{}'"
  );
  console.log("Migration applied");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
