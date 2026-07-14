const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("fs");
const { resolve } = require("path");

const migrationPath =
  process.argv[2] || "supabase/migrations/20260714191000_job_link_intake.sql";
const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(resolve(__dirname, "..", migrationPath), "utf8");
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log(`Applied migration: ${migrationPath}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
