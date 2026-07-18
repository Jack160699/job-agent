import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
const schema = () =>
  readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("Performance/ATS/Search V1 migration contracts", () => {
  it("gives application_score_records owner-only RLS and cascades on the right parents", () => {
    const sql = migration("20260716120000_application_score_history.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.application_score_records/i);
    expect(sql).toMatch(
      /application_id UUID NOT NULL UNIQUE[\s\S]*REFERENCES public\.applications\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toMatch(
      /tailored_resume_id UUID NOT NULL[\s\S]*REFERENCES public\.tailored_resumes\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toMatch(/ALTER TABLE public\.application_score_records ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(
      /CREATE POLICY application_score_records_owner[\s\S]*user_id = public\.current_app_user_id\(\)/i
    );
  });

  it("keeps the Prisma model in sync with the score-history table's required columns", () => {
    const model = schema();
    expect(model).toMatch(/model ApplicationScoreRecord \{[\s\S]*originalScore\s+Int/);
    expect(model).toMatch(/model ApplicationScoreRecord \{[\s\S]*tailoredScore\s+Int/);
    expect(model).toMatch(/model ApplicationScoreRecord \{[\s\S]*scoreDelta\s+Int/);
    expect(model).toMatch(
      /applicationId\s+String\s+@unique @map\("application_id"\)/
    );
  });

  it("adds work authorization and travel willingness as additive, idempotent columns", () => {
    const sql = migration("20260716130000_settings_work_authorization_travel.sql");
    expect(sql).toMatch(/ALTER TABLE public\.settings/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS work_authorization TEXT/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS travel_willingness TEXT/i);
    expect(sql).not.toMatch(/DROP COLUMN/i);
    expect(schema()).toMatch(/workAuthorization\s+String\?\s+@map\("work_authorization"\)/);
    expect(schema()).toMatch(/travelWillingness\s+String\?\s+@map\("travel_willingness"\)/);
  });
});
