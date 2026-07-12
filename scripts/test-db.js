const { PrismaClient } = require("@prisma/client");

const urls = [
  "postgresql://postgres.rcnigoakmxzlqipsaqvu:JobAgent2026Secure!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  "postgresql://postgres.rcnigoakmxzlqipsaqvu:JobAgent2026Secure!@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  "postgresql://postgres:JobAgent2026Secure!@db.rcnigoakmxzlqipsaqvu.supabase.co:5432/postgres",
  "postgresql://postgres.rcnigoakmxzlqipsaqvu:JobAgent2026Secure!@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
];

async function test() {
  for (const url of urls) {
    const p = new PrismaClient({ datasources: { db: { url } } });
    try {
      const r = await p.$queryRaw`SELECT 1 as test`;
      console.log("OK:", url.split("@")[1]);
      await p.$disconnect();
      return url;
    } catch (e) {
      console.log("FAIL:", url.split("@")[1], "-", e.message.split("\n")[0]);
      await p.$disconnect();
    }
  }
}

test();
