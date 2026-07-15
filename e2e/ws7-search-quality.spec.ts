import { expect, test } from "@playwright/test";

const FAIL_CLOSED = [401, 403, 404, 405];

test.describe("WS7 search quality fail-closed surfaces", () => {
  test("search start fails closed without a session", async ({ request }) => {
    const response = await request.post("/api/jobs/search?async=true");
    expect(FAIL_CLOSED).toContain(response.status());
  });

  test("search progress fails closed without a session", async ({ request }) => {
    const response = await request.get("/api/jobs/progress?type=SEARCH_JOBS");
    expect(FAIL_CLOSED).toContain(response.status());
  });

  test("search cancellation fails closed without a session", async ({
    request,
  }) => {
    const response = await request.delete("/api/jobs/search");
    expect(FAIL_CLOSED).toContain(response.status());
  });

  test("feedback write and undo fail closed without a session", async ({
    request,
  }) => {
    const put = await request.put(
      "/api/jobs/00000000-0000-0000-0000-000000000001/feedback",
      {
        data: { relevant: false, reason: "wrong_location" },
      }
    );
    const del = await request.delete(
      "/api/jobs/00000000-0000-0000-0000-000000000001/feedback"
    );
    expect(FAIL_CLOSED).toContain(put.status());
    expect(FAIL_CLOSED).toContain(del.status());
  });
});
