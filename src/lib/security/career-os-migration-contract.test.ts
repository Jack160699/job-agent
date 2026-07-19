import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260719090548_normalized_candidate_career_os.sql"
  ),
  "utf8"
);
const storageSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260719123000_private_resume_source_storage.sql"
  ),
  "utf8"
);
const addedSourceSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260719143000_add_verified_official_sources.sql"
  ),
  "utf8"
);
const correctedHealthSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260719150000_correct_official_source_health.sql"
  ),
  "utf8"
);

describe("normalized Career OS migration contract", () => {
  it.each([
    "candidate_profiles",
    "candidate_contact_details",
    "candidate_experiences",
    "candidate_projects",
    "candidate_education",
    "candidate_skills",
    "candidate_certifications",
    "candidate_languages",
    "candidate_links",
    "candidate_preferences",
    "candidate_job_targets",
    "candidate_location_preferences",
    "resume_sources",
    "resume_parse_runs",
    "resume_version_sections",
    "profile_field_sources",
    "application_answer_bank",
    "job_sources",
    "job_source_runs",
    "normalized_jobs",
    "job_source_records",
    "job_matches",
    "saved_jobs",
    "agent_runs",
    "agent_run_steps",
    "agent_diagnostics",
    "application_runs",
  ])("creates %s additively", (table) => {
    expect(sql).toMatch(
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(`, "i")
    );
  });

  it("enables RLS for user-owned and source catalog tables", () => {
    expect(sql).toMatch(/ALTER TABLE public\.job_sources ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.normalized_jobs ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/user_id = public\.current_app_user_id\(\)/i);
    expect(sql).toMatch(/TO authenticated/i);
  });

  it("backfills without removing or rewriting the legacy resume", () => {
    expect(sql).toMatch(/INSERT INTO public\.candidate_profiles/i);
    expect(sql).toMatch(/LEFT JOIN public\.master_resume/i);
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO NOTHING/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(sql).not.toMatch(/DELETE FROM public\.master_resume/i);
    expect(sql).not.toMatch(/UPDATE public\.master_resume/i);
  });

  it("records honest unavailable states for unconfigured commercial sources", () => {
    expect(sql).toMatch(
      /\('linkedin'[\s\S]*'authentication_required'[\s\S]*false/i
    );
    expect(sql).toMatch(
      /\('naukri'[\s\S]*'authentication_required'[\s\S]*false/i
    );
    expect(sql).toMatch(/No scraping or CAPTCHA bypass/i);
  });

  it("adds government preferences and explicit official source enum values", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.settings[\s\S]*sector_preference[\s\S]*government_categories/i
    );
    for (const source of [
      "UPSC",
      "ISRO",
      "NTPC",
      "BEL",
      "IOCL",
      "IBPS",
      "RAILWAYS",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER TYPE public\\.job_source ADD VALUE IF NOT EXISTS '${source}'`,
          "i"
        )
      );
    }
  });

  it("seeds reachable and blocked government sources without fabricating health", () => {
    expect(sql).toMatch(/\('upsc'[\s\S]*'healthy'[\s\S]*true/i);
    expect(sql).toMatch(/\('isro'[\s\S]*'healthy'[\s\S]*true/i);
    expect(sql).toMatch(/\('ntpc'[\s\S]*'healthy'[\s\S]*true/i);
    expect(sql).toMatch(/\('bel'[\s\S]*'unavailable'[\s\S]*false/i);
    expect(sql).toMatch(/\('iocl'[\s\S]*'blocked'[\s\S]*false/i);
    expect(sql).toMatch(/no unsafe bypass is used/i);
  });

  it("keeps original resume files private and size limited", () => {
    expect(storageSql).toMatch(/'resume-sources'/i);
    expect(storageSql).toMatch(/\bpublic,\s*file_size_limit/i);
    expect(storageSql).toMatch(/\bfalse,\s*5242880/i);
    expect(storageSql).toMatch(/application\/pdf/i);
    expect(storageSql).toMatch(/wordprocessingml\.document/i);
    expect(storageSql).not.toMatch(/CREATE POLICY/i);
    expect(storageSql).not.toMatch(/\bpublic\s*=\s*true/i);
  });

  it("adds newly verified official source enum values forward-only", () => {
    for (const source of ["SSC", "DRDO", "RBI"]) {
      expect(addedSourceSql).toMatch(
        new RegExp(
          `ALTER TYPE public\\.job_source ADD VALUE IF NOT EXISTS '${source}'`,
          "i"
        )
      );
    }
    expect(addedSourceSql).not.toMatch(/\bDROP\b/i);
  });

  it("records blocked source health honestly after live verification", () => {
    expect(correctedHealthSql).toMatch(
      /WHERE key = 'ssc'[\s\S]*WHERE key = 'rbi'/i
    );
    expect(correctedHealthSql).toMatch(/CAPTCHA challenge; no bypass is used/i);
    expect(correctedHealthSql).toMatch(/status = 'blocked'/i);
    expect(correctedHealthSql).toMatch(/enabled = false/i);
  });
});
