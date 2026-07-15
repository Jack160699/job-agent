import { describe, expect, it } from "vitest";
import { fillCommonFields } from "./base";

describe("fillCommonFields", () => {
  it("does not invent a last-name placeholder", async () => {
    const typed: Array<{ ref: string; value: string }> = [];
    const browser = {
      snapshot: async () => ({
        elements: [
          { ref: "f1", role: "textbox", name: "First Name" },
          { ref: "l1", role: "textbox", name: "Last Name" },
          { ref: "e1", role: "textbox", name: "Email" },
        ],
      }),
      type: async (ref: string, value: string) => {
        typed.push({ ref, value });
      },
      fill: async () => undefined,
    };

    await fillCommonFields(browser as never, {
      fullName: "Priya",
      email: "priya@example.com",
    });

    expect(typed).toEqual([
      { ref: "f1", value: "Priya" },
      { ref: "e1", value: "priya@example.com" },
    ]);
    expect(typed.some((entry) => entry.value === "-")).toBe(false);
  });
});
