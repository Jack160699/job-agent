import { test, expect, type Page } from "@playwright/test";
import { SAMPLE_RESUME } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail, loginWithSharedAccount } from "./helpers/auth";

async function buildSampleResumePdf(): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const lines = SAMPLE_RESUME.split("\n");
  let y = 760;
  for (const line of lines) {
    if (y < 40) break;
    page.drawText(line.slice(0, 95), { x: 40, y, size: 10, font });
    y -= 14;
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function freshUser(tag: string) {
  return {
    fullName: `Resume Onboarding ${tag}`,
    email: `qa.resume-onboarding-${tag}.${Date.now()}@jobagent-e2e.test`,
    password:
      process.env.E2E_EPHEMERAL_PASSWORD ||
      `QaEphemeral_${Date.now()}_${Math.random().toString(36).slice(2, 10)}!`,
  };
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function choosePersona(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/onboarding/, { timeout: 15000 });
  const jobSeekerChoice = page.getByRole("button", { name: /Find my next job/i });
  if (await jobSeekerChoice.isVisible().catch(() => false)) {
    await jobSeekerChoice.click();
  }
}

test.describe("Resume-first onboarding", () => {
  test("new user sees resume upload first, completes the full flow, and reaches jobs", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const user = freshUser("full");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);

      // 1. New user sees resume upload first.
      await expect(page.getByRole("heading", { name: "Start with your resume" })).toBeVisible();
      await expect(page.getByText(/Kairela will prepare most of your career profile/i)).toBeVisible();

      // 2. User uploads a fixture PDF.
      const pdfBuffer = await buildSampleResumePdf();
      const uploadResponse = page.waitForResponse(
        (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
      );
      await page
        .getByLabel("Choose a resume file to upload")
        .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: pdfBuffer });
      expect((await uploadResponse).ok()).toBeTruthy();

      // 3. Processing finishes; 4. Extracted information appears.
      await expect(page.getByRole("heading", { name: "We found these details" })).toBeVisible({
        timeout: 20000,
      });
      await expect(page.getByText("TypeScript", { exact: false }).first()).toBeVisible();

      // 5. User edits one value.
      const fullNameInput = page.locator("#review-fullName");
      await fullNameInput.fill("Edited Name QA");

      // 6. User confirms review.
      await page.getByRole("button", { name: /Looks good, continue/i }).click();

      // 7. User answers missing preferences.
      await expect(page.getByRole("heading", { name: /Tell us what your resume can't/i })).toBeVisible({
        timeout: 15000,
      });
      const locationsInput = page.getByLabel("Add to Preferred locations");
      await locationsInput.fill("Remote");
      await locationsInput.press("Enter");
      await page.getByRole("button", { name: "Remote", exact: true }).click();
      await page.getByRole("button", { name: /^Continue$/i }).click();

      // 8. User reaches personalized jobs.
      await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: /Go to dashboard/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/jobs/, { timeout: 15000 });

      // 9. Refresh does not restart onboarding.
      await page.goto("/dashboard/onboarding");
      await expect(page).toHaveURL(/\/dashboard\/jobs/, { timeout: 15000 });
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("continue-without-resume works and asks baseline questions", async ({ page }) => {
    test.setTimeout(120000);
    const user = freshUser("skip");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);

      await expect(page.getByRole("heading", { name: "Start with your resume" })).toBeVisible();
      await page.getByRole("button", { name: /Continue without a resume/i }).click();

      await expect(page.getByRole("heading", { name: /Tell us what your resume can't/i })).toBeVisible({
        timeout: 15000,
      });
      // Reduced manual path must ask baseline questions the resume would have answered.
      await expect(page.getByLabel("Full name")).toBeVisible();
      await expect(page.getByLabel("Current location")).toBeVisible();
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("mobile viewport: resume screen has no horizontal overflow and meets tap-target size", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 320, height: 720 });
    const user = freshUser("mobile");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);
      await expect(page.getByRole("heading", { name: "Start with your resume" })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      const skipButton = page.getByRole("button", { name: /Continue without a resume/i });
      const box = await skipButton.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    } finally {
      await deleteUserByEmail(user.email);
    }
  });

  test("existing completed user is not redirected back into onboarding", async ({ page }) => {
    await loginWithSharedAccount(page);
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/dashboard\/onboarding/, { timeout: 10000 });
  });
});
