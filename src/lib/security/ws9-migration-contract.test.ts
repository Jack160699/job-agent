import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260715200000_ws9_application_automation.sql"
  ),
  "utf8"
);

describe("WS9 database contracts", () => {
  it.each([
    "NEEDS_INFORMATION",
    "AWAITING_APPROVAL",
    "BLOCKED_CAPTCHA",
    "BLOCKED_LOGIN",
    "UNSUPPORTED",
    "EXPIRED",
  ])("adds the %s application state", (status) => {
    expect(sql).toMatch(
      new RegExp(`ADD VALUE IF NOT EXISTS '${status}'`, "i")
    );
  });

  it("prevents duplicate active browser-task delivery", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS browser_tasks_active_delivery_unique/i
    );
    expect(sql).toMatch(
      /WHERE application_id IS NOT NULL[\s\S]*status IN \('pending', 'running'\)/i
    );
  });
});
