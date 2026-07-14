import { expect, test } from "@playwright/test";

test.describe("Consultant conversations", () => {
  test("conversation APIs fail closed without a session", async ({ request }) => {
    const [list, create, confirm] = await Promise.all([
      request.get("/api/consultant/conversations"),
      request.post("/api/consultant/conversations"),
      request.post("/api/consultant/actions/confirm", {
        data: { proposalId: "00000000-0000-0000-0000-000000000000" },
      }),
    ]);

    expect(list.status()).toBe(401);
    expect(create.status()).toBe(401);
    expect(confirm.status()).toBe(401);
  });
});
