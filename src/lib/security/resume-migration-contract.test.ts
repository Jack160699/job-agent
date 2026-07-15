import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
const schema = () =>
  readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("resume database migration contracts", () => {
  it("preserves tailored rows and nulls their master reference", () => {
    const sql = migration(
      "20260715180000_preserve_tailored_on_master_delete.sql"
    );
    expect(sql).toMatch(/ALTER COLUMN master_resume_id DROP NOT NULL/i);
    expect(sql).toMatch(
      /FOREIGN KEY \(master_resume_id\)[\s\S]*ON DELETE SET NULL/i
    );
    expect(schema()).toMatch(
      /masterResume\s+MasterResume\?\s+@relation\([^)]*onDelete: SetNull\)/
    );
  });

  it("keeps application references valid when a tailored master is removed", () => {
    const initial = migration("20260712000000_initial_schema.sql");
    expect(initial).toMatch(
      /application_id UUID UNIQUE REFERENCES applications\(id\) ON DELETE SET NULL/i
    );
    expect(
      migration("20260715180000_preserve_tailored_on_master_delete.sql")
    ).not.toMatch(/application_id/i);
  });

  it("protects tailored version history with owner RLS", () => {
    const sql = migration("20260715190000_resume_history_grounding.sql");
    expect(sql).toMatch(
      /ALTER TABLE public\.tailored_resume_versions ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /CREATE POLICY tailored_resume_versions_owner[\s\S]*user_id = public\.current_app_user_id\(\)/i
    );
    expect(sql).toMatch(
      /tailored_resume_id UUID NOT NULL[\s\S]*ON DELETE CASCADE/i
    );
  });
});
