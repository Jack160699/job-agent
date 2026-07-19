import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260720013000_saved_searches_and_alerts.sql"
  ),
  "utf8"
);

describe("saved-search and alert migration contract", () => {
  it("persists every required search and schedule field", () => {
    expect(sql).toMatch(/titles TEXT\[\] NOT NULL/i);
    expect(sql).toMatch(/locations TEXT\[\] NOT NULL/i);
    expect(sql).toMatch(/sector TEXT NOT NULL/i);
    expect(sql).toMatch(/government_categories TEXT\[\]/i);
    expect(sql).toMatch(/filters JSONB NOT NULL/i);
    expect(sql).toMatch(/search_stage TEXT NOT NULL/i);
    expect(sql).toMatch(/sources public\.job_source\[\]/i);
    expect(sql).toMatch(/alert_frequency TEXT NOT NULL/i);
    expect(sql).toMatch(/next_run_at TIMESTAMPTZ/i);
  });

  it("enforces owner-only row access and cascading cleanup", () => {
    expect(sql).toMatch(
      /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toMatch(/ALTER TABLE public\.saved_searches ENABLE ROW LEVEL SECURITY/i);
    expect(sql.match(/user_id = public\.current_app_user_id\(\)/g)?.length).toBe(
      5
    );
  });

  it("only permits off, daily, or weekly schedules", () => {
    expect(sql).toMatch(
      /CHECK \(alert_frequency IN \('OFF', 'DAILY', 'WEEKLY'\)\)/i
    );
  });
});
