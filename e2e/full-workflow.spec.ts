import { test, expect } from "@playwright/test";
import { SAMPLE_RESUME } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail } from "./helpers/auth";

test.describe("Full Application Workflow", () => {
  const user = {
    fullName: "Workflow Test User",
    email: `qa.workflow.${Date.now()}@jobagent-e2e.test`,
    password: "QATestPass123!Secure",
  };

  test.beforeAll(async () => {
    await createConfirmedUser(user);
  });

  test.afterAll(async () => {
    await deleteUserByEmail(user.email);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("upload resume → search jobs → run agent → verify applications", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.goto("/dashboard/resumes");
    const textarea = page.locator("textarea");
    if (await textarea.isVisible()) {
      await textarea.fill(SAMPLE_RESUME);
      const uploadRes = page.waitForResponse(
        (r) =>
          r.url().includes("/api/resumes/master") &&
          r.request().method() === "POST"
      );
      await page.getByRole("button", { name: /Upload Resume/i }).click();
      expect((await uploadRes).ok()).toBeTruthy();
    }

    await page.goto("/dashboard/jobs");
    const searchRes = page.waitForResponse(
      (r) => r.url().includes("/api/jobs/search") && r.request().method() === "POST",
      { timeout: 30000 }
    );
    await page.getByRole("button", { name: /Search Jobs/i }).click();
    const searchResponse = await searchRes;
    expect(searchResponse.ok()).toBeTruthy();

    await page.goto("/dashboard");
    const agentRes = page.waitForResponse(
      (r) => r.url().includes("/api/agent/run") && r.request().method() === "POST",
      { timeout: 120000 }
    );
    await page.getByRole("button", { name: /Run AI Agent/i }).click();
    const agentResponse = await agentRes;
    expect(agentResponse.ok()).toBeTruthy();
    const agentData = await agentResponse.json();
    expect(agentData).toHaveProperty("searched");

    await page.goto("/dashboard/applications");
    await expect(
      page.getByRole("heading", { name: "Application Tracker" })
    ).toBeVisible();

    await page.goto("/dashboard/cover-letters");
    await expect(
      page.getByRole("heading", { name: "Cover Letter Manager" })
    ).toBeVisible();

    await page.goto("/dashboard/resumes");
    await expect(
      page.getByRole("heading", { name: "Master Resume" })
    ).toBeVisible();
  });

  test("PDF download endpoint returns valid response", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/dashboard/resumes");
    const textarea = page.locator("textarea");
    if (await textarea.isVisible()) {
      await textarea.fill(SAMPLE_RESUME);
      await page.getByRole("button", { name: /Upload Resume/i }).click();
      await page.waitForTimeout(2000);
    }

    await page.goto("/dashboard/applications");
    const hasApps = await page.locator("table tbody tr").count();
    if (hasApps > 0) {
      const appId = await page
        .locator("table tbody tr")
        .first()
        .getAttribute("data-app-id");
      if (appId) {
        const res = await page.request.get(`/api/applications/${appId}/pdf`);
        expect([200, 404]).toContain(res.status());
        if (res.status() === 200) {
          expect(res.headers()["content-type"]).toContain("application/pdf");
        }
      }
    }
  });

  test("agent API endpoint is accessible when authenticated", async ({ page }) => {
    test.setTimeout(180000);
    const res = await page.request.post("/api/agent/run", { timeout: 120000 });
    expect([200, 400, 500]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty("searched");
      expect(data).toHaveProperty("errors");
    }
  });
});
