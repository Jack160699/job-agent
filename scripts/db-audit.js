const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const tables = [
    "users",
    "master_resume",
    "jobs",
    "applications",
    "settings",
    "logs",
    "background_jobs",
  ];

  const counts = {};
  for (const table of tables) {
    const result = await p.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM ${table}`
    );
    counts[table] = result[0].count;
  }

  const indexes = await p.$queryRaw`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;

  const policies = await p.$queryRaw`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const fkeys = await p.$queryRaw`
    SELECT conname, conrelid::text AS table_name
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    ORDER BY conname
  `;

  console.log(
    JSON.stringify(
      {
        counts,
        indexCount: indexes.length,
        policyCount: policies.length,
        foreignKeyCount: fkeys.length,
        indexes: indexes.slice(0, 20),
        policies: policies.slice(0, 15),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
