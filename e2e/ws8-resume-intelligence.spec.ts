import { expect, test } from "@playwright/test";

const FAIL_CLOSED = [401, 403, 404, 405];

test.describe("WS8 resume APIs fail closed", () => {
  test("mutating master resume APIs require a session", async ({ request }) => {
    const [post, del, restore] = await Promise.all([
      request.post("/api/resumes/master", {
        data: { title: "Master Resume", rawText: "x".repeat(100) },
      }),
      request.delete("/api/resumes/master"),
      request.post("/api/resumes/master/versions", {
        data: { versionId: "00000000-0000-0000-0000-000000000001" },
      }),
    ]);
    expect(FAIL_CLOSED).toContain(post.status());
    expect(FAIL_CLOSED).toContain(del.status());
    expect(FAIL_CLOSED).toContain(restore.status());
  });

  test("tailored PDF export requires a session", async ({ request }) => {
    const response = await request.get(
      "/api/resumes/00000000-0000-0000-0000-000000000001/pdf"
    );
    expect(FAIL_CLOSED).toContain(response.status());
  });
});
