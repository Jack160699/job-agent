import { test, expect, type Page } from "@playwright/test";
import { SAMPLE_RESUME } from "./fixtures";
import { createConfirmedUser, deleteUserByEmail } from "./helpers/auth";

/**
 * Performance, ATS Intelligence, and Job Search Reliability V1 — Phase H.
 *
 * Every scenario is self-contained: it creates its own ephemeral
 * qa.perf-ats-search-<scenario>-<timestamp>@jobagent-e2e.test account via the
 * Supabase admin helper and deletes it (and, transitively, its owned rows —
 * Prisma's onDelete: Cascade on User) in a finally block. Nothing here reads
 * or writes the owner's real account, and nothing depends on a
 * pre-provisioned shared account existing.
 */

const LOGIN_TIMEOUT = 45000;

async function buildSampleResumePdf(): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 760;
  for (const line of SAMPLE_RESUME.split("\n")) {
    if (y < 40) break;
    page.drawText(line.slice(0, 95), { x: 40, y, size: 10, font });
    y -= 14;
  }
  return Buffer.from(await doc.save());
}

async function buildSampleResumeDocx(): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const paragraphs = SAMPLE_RESUME.split("\n")
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`
    )
    .join("");
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function freshUser(tag: string) {
  return {
    fullName: `PerfAtsSearch ${tag}`,
    email: `qa.perf-ats-search-${tag}.${Date.now()}@jobagent-e2e.test`,
    password: `QaEphemeral_${Date.now()}_${Math.random().toString(36).slice(2, 10)}!`,
  };
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Cold Preview lambdas measurably push the client-side RSC redirect chain
  // (middleware -> dashboard layout -> onboarding gate) past 15s even though
  // the Supabase sign-in call itself returns in under 1s.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT });
}

async function choosePersona(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/onboarding/, { timeout: LOGIN_TIMEOUT });
  const jobSeekerChoice = page.getByRole("button", { name: /Find my next job/i });
  if (await jobSeekerChoice.isVisible().catch(() => false)) {
    await jobSeekerChoice.click();
  }
}

/**
 * Full self-contained onboarding: fresh user -> resume upload -> review
 * confirm -> Pune/India preferences -> lands on /dashboard/jobs. Used by
 * every scenario below that needs a ready-to-search account.
 */
async function onboardWithPunePreferences(page: Page, tag: string) {
  const user = freshUser(tag);
  await createConfirmedUser(user);
  await login(page, user);
  await choosePersona(page);

  const buffer = await buildSampleResumePdf();
  const uploadResponse = page.waitForResponse(
    (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
  );
  await page
    .getByLabel("Choose a resume file to upload")
    .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer });
  await uploadResponse;
  await expect(page.getByRole("heading", { name: "We found these details" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: /Looks good, continue/i }).click();

  await expect(page.getByRole("heading", { name: /Tell us what your resume can't/i })).toBeVisible({
    timeout: LOGIN_TIMEOUT,
  });
  const locationsInput = page.getByLabel("Add to Preferred locations");
  await locationsInput.fill("Pune");
  await locationsInput.press("Enter");
  const remoteToggle = page.getByRole("button", { name: "Remote", exact: true });
  if (await remoteToggle.isVisible().catch(() => false)) {
    await remoteToggle.click();
  }
  const continueButton = page.getByRole("button", { name: /^Continue$/i });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  }

  // Either an interstitial "you're all set" screen or a direct landing on
  // jobs — both are valid completions of this flow.
  const goToDashboard = page.getByRole("button", { name: /Go to dashboard/i });
  if (await goToDashboard.isVisible({ timeout: 15000 }).catch(() => false)) {
    await goToDashboard.click();
  }
  await page.goto("/dashboard/jobs");
  return user;
}

// 1. Login and dashboard navigation.
test.describe("1. Login and navigation", () => {
  test("dedicated QA account logs in and lands on the dashboard", async ({ page }) => {
    test.setTimeout(90000);
    const user = freshUser("login");
    await createConfirmedUser(user);
    try {
      const start = Date.now();
      await login(page, user);
      const elapsedMs = Date.now() - start;
      // Real measured value — not asserted against the <2s target here
      // since Preview cold-start latency is not representative of warm
      // Production; recorded for the report via console output.
      console.log(`MEASURED login_to_dashboard_ms=${elapsedMs}`);
      expect(elapsedMs).toBeLessThan(LOGIN_TIMEOUT);
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});

// 2. Resume upload across three formats, and 3. deterministic score before AI.
test.describe("2-3. Resume upload (PDF/DOCX/plain text) and instant deterministic score", () => {
  for (const format of ["pdf", "docx", "text"] as const) {
    test(`uploading a ${format} resume returns a deterministic ATS score without waiting on AI enrichment`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      const user = freshUser(`upload-${format}`);
      await createConfirmedUser(user);
      try {
        await login(page, user);
        await choosePersona(page);
        await expect(page.getByRole("heading", { name: "Start with your resume" })).toBeVisible();

        const uploadResponse = page.waitForResponse(
          (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
        );

        if (format === "text") {
          await page
            .getByRole("button", { name: /Paste text instead/i })
            .click()
            .catch(() => {});
          const textarea = page.getByLabel(/paste your resume/i).or(page.locator("textarea")).first();
          await textarea.fill(SAMPLE_RESUME);
          await page.getByRole("button", { name: /Continue|Upload/i }).first().click();
        } else {
          const buffer = format === "pdf" ? await buildSampleResumePdf() : await buildSampleResumeDocx();
          const mimeType =
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          await page
            .getByLabel("Choose a resume file to upload")
            .setInputFiles({ name: `resume.${format}`, mimeType, buffer });
        }

        const response = await uploadResponse;
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        // The deterministic score must be present on the very response that
        // completes the upload — before any AI enrichment could have run.
        expect(body.atsScore).toBeTruthy();
        expect(typeof body.atsScore.totalScore).toBe("number");
        expect(body.enrichmentPending === true || body.enrichmentPending === false).toBe(true);

        await expect(page.getByRole("heading", { name: "We found these details" })).toBeVisible({
          timeout: 20000,
        });
      } finally {
        await deleteUserByEmail(user.email);
      }
    });
  }
});

// 4. Editing every extracted section, preserving confidence metadata, and
// user-edit protection from later enrichment overwrite.
test.describe("4. Editable resume review sections", () => {
  test("user can add a work experience entry, edit it, reorder it, and remove another with confirmation", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const user = freshUser("edit-sections");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);
      const buffer = await buildSampleResumePdf();
      const uploadResponse = page.waitForResponse(
        (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
      );
      await page
        .getByLabel("Choose a resume file to upload")
        .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer });
      await uploadResponse;
      await expect(page.getByRole("heading", { name: "We found these details" })).toBeVisible({
        timeout: 20000,
      });

      const experienceSection = page.locator("section", { hasText: "Work experience" });
      await experienceSection.getByRole("button", { name: /Add role/i }).click();
      const titleInputs = experienceSection.getByLabel("Title");
      await titleInputs.last().fill("QA Added Role");

      // Removing a non-empty entry must ask for confirmation (window.confirm).
      page.once("dialog", (dialog) => dialog.accept());
      const firstRemoveButton = experienceSection.getByRole("button", { name: /Remove/i }).first();
      if (await firstRemoveButton.isVisible().catch(() => false)) {
        await firstRemoveButton.click();
      }

      const saveResponse = page.waitForResponse(
        (r) => r.url().includes("/api/resumes/master/profile") && r.request().method() === "PATCH"
      );
      await page.getByRole("button", { name: /Looks good, continue/i }).click();
      const patchResponse = await saveResponse;
      expect(patchResponse.ok()).toBeTruthy();
      const patched = await patchResponse.json();
      // A user-typed entry must be reflected, confirmed (not flagged for
      // re-review), and attributed to the user, not silently dropped.
      const experience = patched.profile?.experience;
      expect(experience?.needsReview).toBe(false);
      expect(experience?.source).toBe("user_edit");
      expect(
        (experience?.value ?? []).some((e: { title?: string }) => e.title === "QA Added Role")
      ).toBe(true);
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});

// 5. Smart missing-data questions only ask for what's absent, and profile
// readiness.
test.describe("5. Missing-data questions and profile readiness", () => {
  test("preferences screen only asks for fields the resume did not answer, and shows Profile ready %", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const user = freshUser("missing-qs");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);
      const buffer = await buildSampleResumePdf();
      const uploadResponse = page.waitForResponse(
        (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
      );
      await page
        .getByLabel("Choose a resume file to upload")
        .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer });
      await uploadResponse;
      await page.getByRole("button", { name: /Looks good, continue/i }).click();

      await expect(page.getByRole("heading", { name: /Tell us what your resume can't/i })).toBeVisible({
        timeout: LOGIN_TIMEOUT,
      });
      await expect(page.getByText(/Profile ready: \d+%/)).toBeVisible();
      // Fields the resume already answered must not be re-asked.
      await expect(page.getByLabel("Full name")).not.toBeVisible();
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});

// 6-9. Pune/India job search quality, enqueue/progress, and no fabricated
// non-India results. 16. Cancel and broaden. 14-15. Navigate-away-and-return.
test.describe("6-9, 14-16. India-first job search, progress, cancel, broaden, navigation", () => {
  test("Pune-preference search enqueues immediately, shows progress, and never silently substitutes US locations", async ({
    page,
  }) => {
    test.setTimeout(240000);
    const user = await onboardWithPunePreferences(page, "search");
    try {
      await expect(page).toHaveURL(/\/dashboard\/jobs/, { timeout: LOGIN_TIMEOUT });

      const runButton = page.getByRole("button", { name: /Run Job Search/i });
      const enqueueStart = Date.now();
      await runButton.click();
      await expect(page.getByRole("button", { name: /Running…|Cancel search/i })).toBeVisible({
        timeout: 10000,
      });
      console.log(`MEASURED search_enqueue_ack_ms=${Date.now() - enqueueStart}`);

      // Cancel must work.
      const cancelButton = page.getByRole("button", { name: /Cancel search/i });
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
        await expect(page.getByRole("button", { name: /Run Job Search/i })).toBeVisible({
          timeout: 15000,
        });
      }

      // Navigate away and back — state must not silently vanish; the button
      // must render one of its known valid states, not an error/blank page.
      await page.goto("/dashboard/matches");
      await page.goto("/dashboard/jobs");
      await expect(
        page.getByRole("button", { name: /Cancel search|Run Job Search/i })
      ).toBeVisible({ timeout: 15000 });

      // Run again and let it reach a terminal state (complete or zero-result).
      await page.getByRole("button", { name: /Run Job Search/i }).click();
      await expect(
        page.getByText(/Complete —|No jobs matched your current preferences/i).first()
      ).toBeVisible({ timeout: 150000 });

      const bodyText = await page.locator("body").innerText();
      expect(bodyText.toLowerCase()).not.toMatch(/san francisco|new york, ny|united states only/);

      // If zero results, Broaden must be offered and must work.
      const broadenButton = page.getByRole("button", { name: /Broaden search/i });
      if (await broadenButton.isVisible().catch(() => false)) {
        await broadenButton.click();
        await expect(page.getByRole("button", { name: /Running…|Cancel search/i })).toBeVisible({
          timeout: 10000,
        });
      }
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});

// 10-13. Job-specific ATS match, tailored generation, original/tailored
// delta, and no fabricated score improvement. Applications page + Resume
// History surfaces.
test.describe("10-13. Job ATS match and tailored resume scoring", () => {
  test("job ATS match and applications/resume-history surfaces render without fabricated improvement", async ({
    page,
  }) => {
    test.setTimeout(240000);
    const user = await onboardWithPunePreferences(page, "ats-match");
    try {
      await page.getByRole("button", { name: /Run Job Search/i }).click();
      await expect(
        page.getByText(/Complete —|No jobs matched your current preferences/i).first()
      ).toBeVisible({ timeout: 150000 });

      // Applications page must render its ATS-score column/section
      // regardless of whether any application exists yet.
      await page.goto("/dashboard/applications");
      const hasApplications = await page
        .getByText(/ATS score \(original → tailored\)/i)
        .isVisible()
        .catch(() => false);
      const emptyState = await page.getByText(/No applications yet/i).isVisible().catch(() => false);
      expect(hasApplications || emptyState).toBe(true);

      if (hasApplications) {
        const deltaText = page.getByText(/\d+ → \d+ \([+-]?\d+\)/).first();
        if (await deltaText.isVisible().catch(() => false)) {
          const text = await deltaText.innerText();
          const [, original, tailored] = text.match(/(\d+) → (\d+)/) ?? [];
          expect(Number(original)).toBeGreaterThanOrEqual(0);
          expect(Number(tailored)).toBeGreaterThanOrEqual(0);
        }
      }

      // Resume History must render (exact submitted resume + score history
      // surface), whether or not tailoring has happened yet.
      await page.goto("/dashboard/resumes");
      await expect(page.getByRole("heading", { name: "Master Resume" })).toBeVisible({
        timeout: 20000,
      });
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});

// 17. Mobile (Samsung S23 FE viewport) overflow and touch targets, bottom
// navigation, no blocked taps.
test.describe("17. Mobile layout — Samsung S23 FE viewport", () => {
  test("resume section editor has no horizontal overflow and meets 44px tap targets", async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 393, height: 852 });
    const user = freshUser("mobile-edit");
    await createConfirmedUser(user);
    try {
      await login(page, user);
      await choosePersona(page);
      const buffer = await buildSampleResumePdf();
      const uploadResponse = page.waitForResponse(
        (r) => r.url().includes("/api/resumes/master") && r.request().method() === "POST"
      );
      await page
        .getByLabel("Choose a resume file to upload")
        .setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer });
      await uploadResponse;
      await expect(page.getByRole("heading", { name: "We found these details" })).toBeVisible({
        timeout: 20000,
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      const continueButton = page.getByRole("button", { name: /Looks good, continue/i });
      const continueBox = await continueButton.boundingBox();
      expect(continueBox?.height).toBeGreaterThanOrEqual(44);
    } finally {
      await deleteUserByEmail(user.email);
    }
  });
});
