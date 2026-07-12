import { describe, it, expect } from "vitest";
import { envSchema } from "@/lib/env";

describe("envSchema", () => {
  it("parses valid environment", () => {
    const result = envSchema.parse({
      NODE_ENV: "development",
      RATE_LIMIT_MAX: "100",
      RATE_LIMIT_WINDOW_MS: "60000",
    });
    expect(result.NODE_ENV).toBe("development");
    expect(result.RATE_LIMIT_MAX).toBe(100);
  });

  it("applies defaults", () => {
    const result = envSchema.parse({});
    expect(result.RATE_LIMIT_MAX).toBe(100);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(60000);
  });
});
