import { describe, it, expect } from "vitest";
import { withResilience, findElementWithFallbacks } from "./resilient";

describe("resilient automation", () => {
  it("withResilience retries then succeeds", async () => {
  let attempts = 0;
  const result = await withResilience(
    async () => {
      attempts++;
      if (attempts < 2) throw new Error("transient");
      return "ok";
    },
    { label: "test", retries: 3, delayMs: 10 }
  );
  expect(result).toBe("ok");
  expect(attempts).toBe(2);
  });

  it("findElementWithFallbacks matches patterns", () => {
  const snap = {
    elements: [
      { ref: "e0", role: "button", name: "Apply for this job" },
      { ref: "e1", role: "input", name: "Email" },
    ],
  };
  const el = findElementWithFallbacks(snap, [/submit/i], [/apply/i]);
  expect(el?.ref).toBe("e0");
  });
});
