import { expect, test } from "@playwright/test";

test.describe("Job-seeker recovery and authorization", () => {
  test("sensitive workflow APIs fail closed without a session", async ({
    request,
  }) => {
    const [resume, progress, cancelSearch, application] = await Promise.all([
      request.get("/api/resumes/master"),
      request.get("/api/jobs/progress?type=SEARCH_JOBS"),
      request.delete("/api/jobs/search"),
      request.get("/api/applications/00000000-0000-0000-0000-000000000000"),
    ]);

    expect(resume.status()).toBe(401);
    expect(progress.status()).toBe(401);
    expect(cancelSearch.status()).toBe(401);
    expect(application.status()).toBe(401);
  });
});
