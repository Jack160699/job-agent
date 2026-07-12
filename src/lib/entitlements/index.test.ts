import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@/lib/entitlements";

describe("entitlements", () => {
  it("defines limits for all plans", () => {
    expect(PLAN_LIMITS.FREE.jobSearchesPerMonth).toBeGreaterThan(0);
    expect(PLAN_LIMITS.PRO.jobSearchesPerMonth).toBeGreaterThan(
      PLAN_LIMITS.FREE.jobSearchesPerMonth
    );
    expect(PLAN_LIMITS.TEAM.jobSearchesPerMonth).toBeGreaterThan(
      PLAN_LIMITS.PRO.jobSearchesPerMonth
    );
  });
});
