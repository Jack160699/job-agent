import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260715210000_ws10_durable_oauth_state.sql"
  ),
  "utf8"
);
const gmailSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260715220000_ws10_gmail_user_isolation.sql"
  ),
  "utf8"
);

describe("WS10 OAuth state database contract", () => {
  it("stores expiring single-use nonces per user", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.oauth_state_nonces/i);
    expect(sql).toMatch(/nonce text PRIMARY KEY/i);
    expect(sql).toMatch(/user_id uuid NOT NULL REFERENCES public\.users\(id\)/i);
    expect(sql).toMatch(/expires_at timestamptz NOT NULL/i);
    expect(sql).toMatch(/consumed_at timestamptz/i);
  });

  it("keeps nonce rows out of the Data API", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(
      /REVOKE ALL ON public\.oauth_state_nonces FROM anon, authenticated/i
    );
  });

  it("deduplicates Gmail messages within a user, not globally", () => {
    expect(gmailSql).toMatch(
      /DROP CONSTRAINT IF EXISTS emails_gmail_id_key/i
    );
    expect(gmailSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS emails_user_id_gmail_id_key[\s\S]*\(user_id, gmail_id\)/i
    );
  });
});
