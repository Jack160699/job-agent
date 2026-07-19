import prisma from "../src/lib/db";

async function main() {
  try {
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string; row_security: boolean }>
    >`
      SELECT c.relname AS table_name, c.relrowsecurity AS row_security
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'application_answer_bank',
          'application_answer_versions',
          'application_answer_usage'
        )
      ORDER BY c.relname
    `;
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'application_answer_bank'
        AND column_name IN ('is_private', 'version')
      ORDER BY column_name
    `;
    const policies = await prisma.$queryRaw<
      Array<{ tablename: string; policyname: string }>
    >`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'application_answer_versions',
          'application_answer_usage'
        )
      ORDER BY tablename, policyname
    `;
    console.log(JSON.stringify({ tables, columns, policies }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
