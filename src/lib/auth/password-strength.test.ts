import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength, isPasswordAcceptable } from "@/lib/auth/password-strength";

describe("password strength", () => {
  it("rejects short passwords", () => {
    expect(isPasswordAcceptable("abc")).toBe(false);
  });

  it("accepts strong passwords", () => {
    expect(isPasswordAcceptable("Kairela2026!")).toBe(true);
    expect(evaluatePasswordStrength("Kairela2026!").strength).toBe("strong");
  });
});
