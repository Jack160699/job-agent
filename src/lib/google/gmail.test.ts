import { describe, expect, it } from "vitest";
import { parseHeaderEmail } from "./gmail";

describe("Gmail synchronization helpers", () => {
  it("extracts the account address used for message direction", () => {
    expect(parseHeaderEmail("Jane Applicant <jane@example.com>")).toBe(
      "jane@example.com"
    );
    expect(parseHeaderEmail("jane@example.com")).toBe("jane@example.com");
  });
});
