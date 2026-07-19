import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260719164216_application_answer_bank_ui.sql"
  ),
  "utf8"
);

describe("application answer bank migration contract", () => {
  it.each(["application_answer_versions", "application_answer_usage"])(
    "creates %s additively",
    (table) => {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(`, "i")
      );
    }
  );

  it("enables owner-scoped RLS for history and usage", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.application_answer_versions ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.application_answer_usage ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql.match(/user_id = public\.current_app_user_id\(\)/gi)).toHaveLength(
      4
    );
    expect(sql).toMatch(/TO authenticated/i);
  });

  it("captures revisions without using a privilege-bypassing trigger", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.capture_application_answer_version/i
    );
    expect(sql).toMatch(/SECURITY INVOKER/i);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE/i);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });

  it("is forward-only", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
});
