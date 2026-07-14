import { expect, test } from "@playwright/test";
import { loginWithSharedAccount } from "./helpers/auth";

test.describe("Proactive career recommendations", () => {
  test("recommendation API requires authentication", async ({ request }) => {
    const response = await request.get("/api/recommendations");
    expect(response.status()).toBe(401);
  });

  test("authenticated user can load recommendation controls", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "Authenticated E2E credentials are required."
    );

    await loginWithSharedAccount(page);
    const response = await page.request.get("/api/recommendations");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.recommendations)).toBeTruthy();
    expect(data.settings).toEqual(
      expect.objectContaining({
        notificationsEnabled: expect.any(Boolean),
        proactiveFrequencyHours: expect.any(Number),
        disabledRecommendationCategories: expect.any(Array),
      })
    );

    await page.goto("/dashboard/settings");
    await page.getByRole("tab", { name: "Recommendations" }).click();
    await expect(
      page.getByRole("heading", { name: "Career recommendations" })
    ).toBeVisible();
    await expect(page.getByText("Quiet hours start")).toBeVisible();
  });
});
