import { expect, test } from "./helpers";

test.describe("ATS automation policy", () => {
  test("browser cancel and queue routes require auth", async ({ request }) => {
    const cancel = await request.post("/api/browser-tasks/demo/cancel");
    expect(cancel.status()).toBe(401);

    const queue = await request.post("/api/browser-queue", {
      data: { applicationId: "demo" },
    });
    expect(queue.status()).toBe(401);
  });
});
