import { expect, test } from "@playwright/test";

test.describe("ATS automation policy", () => {
  test("browser task cancel and status do not succeed without a session", async ({
    request,
  }) => {
    const cancel = await request.post("/api/browser/tasks", {
      data: {
        action: "cancel",
        taskId: "00000000-0000-0000-0000-000000000001",
      },
    });
    const status = await request.post("/api/browser/tasks", {
      data: {
        action: "status",
        taskId: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(cancel.ok()).toBe(false);
    expect(status.ok()).toBe(false);
  });
});
