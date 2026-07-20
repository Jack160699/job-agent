import { expect, test, type Page } from "@playwright/test";
import {
  confirmUserByEmail,
  createConfirmedUser,
  deleteUserByEmail,
  getAdminClient,
} from "./helpers/auth";

type ResumeFormat = "pdf" | "docx" | "text";
type Sector = "PRIVATE" | "GOVERNMENT" | "BOTH";

interface Persona {
  slug: string;
  name: string;
  fullName: string;
  currentRole: string;
  education: string;
  titles: string[];
  skills: string[];
  locations: string[];
  experience: number;
  sector: Sector;
  salaryMin?: number;
  format: ResumeFormat;
}

interface SearchProgress {
  status: string;
  stage: string;
  jobsFound: number;
  jobsNew: number;
  jobsRelevant: number;
  jobsExcluded: number;
  failedSources?: Array<{ source: string; error?: string }>;
  result?: {
    sources?: Array<{
      source: string;
      success: boolean;
      fetched: number;
      relevant?: number;
      invalid?: number;
      duplicates?: number;
      expired?: number;
      error?: string;
    }>;
    searchStageCounts?: {
      strict: number;
      balanced: number;
      recovery: number;
    };
    zeroResultDiagnosis?: {
      explanation?: string[];
      suggestedActions?: string[];
    } | null;
  } | null;
}

const PERSONAS: Persona[] = [
  {
    slug: "mca-software",
    name: "MCA fresher software developer",
    fullName: "Aarav Sharma",
    currentRole: "MCA Graduate",
    education: "Master of Computer Applications, Savitribai Phule Pune University, 2026",
    titles: ["Software Developer", "Associate Software Engineer"],
    skills: ["TypeScript", "React", "Node.js", "SQL"],
    locations: ["Pune", "Bengaluru", "India"],
    experience: 0,
    sector: "PRIVATE",
    salaryMin: 400000,
    format: "pdf",
  },
  {
    slug: "operations",
    name: "Operations and implementation analyst",
    fullName: "Meera Nair",
    currentRole: "Implementation Analyst",
    education: "Bachelor of Business Administration, Christ University, 2023",
    titles: ["Operations Analyst", "Implementation Analyst"],
    skills: ["Operations", "Implementation", "Process improvement", "Excel"],
    locations: ["Bengaluru", "Hyderabad", "India"],
    experience: 2,
    sector: "PRIVATE",
    salaryMin: 500000,
    format: "docx",
  },
  {
    slug: "ai-automation",
    name: "AI automation engineer",
    fullName: "Kabir Iyer",
    currentRole: "Automation Engineer",
    education: "B.Tech Computer Science, VIT, 2021",
    titles: ["AI Engineer", "Automation Engineer"],
    skills: ["Python", "Machine Learning", "Automation", "APIs"],
    locations: ["Bengaluru", "Remote", "India"],
    experience: 4,
    sector: "PRIVATE",
    salaryMin: 900000,
    format: "text",
  },
  {
    slug: "btech-fresher",
    name: "B.Tech computer-science fresher",
    fullName: "Riya Patel",
    currentRole: "Graduate Engineer",
    education: "B.Tech Computer Science, Pune Institute of Computer Technology, 2026",
    titles: ["Graduate Engineer Trainee", "Junior Software Engineer"],
    skills: ["Java", "SQL", "Problem solving", "Git"],
    locations: ["Pune", "Hyderabad", "India"],
    experience: 0,
    sector: "PRIVATE",
    salaryMin: 350000,
    format: "pdf",
  },
  {
    slug: "government-graduate",
    name: "General graduate seeking government jobs",
    fullName: "Arjun Singh",
    currentRole: "Graduate Candidate",
    education: "Bachelor of Arts, University of Delhi, 2025",
    titles: ["Officer", "Assistant", "Graduate Apprentice"],
    skills: ["Administration", "Aptitude", "Communication"],
    locations: ["India"],
    experience: 0,
    sector: "GOVERNMENT",
    format: "docx",
  },
  {
    slug: "diploma-technician",
    name: "Diploma engineer seeking technician, JE and apprenticeship roles",
    fullName: "Vikram Rao",
    currentRole: "Diploma Electrical Engineer",
    education: "Diploma in Electrical Engineering, Government Polytechnic Chennai, 2025",
    titles: ["Technician", "Junior Engineer", "Technician Apprentice"],
    skills: ["Diploma", "Maintenance", "Electrical", "PLC"],
    locations: ["Chennai", "Bengaluru", "India"],
    experience: 0,
    sector: "BOTH",
    salaryMin: 250000,
    format: "text",
  },
  {
    slug: "banking",
    name: "Banking candidate",
    fullName: "Ananya Gupta",
    currentRole: "Banking Operations Associate",
    education: "B.Com Finance, University of Mumbai, 2024",
    titles: ["Banking Associate", "Credit Analyst", "Banking Officer"],
    skills: ["Banking", "Finance", "Customer service", "KYC", "Excel"],
    locations: ["Mumbai", "Bengaluru", "India"],
    experience: 1,
    sector: "BOTH",
    salaryMin: 350000,
    format: "pdf",
  },
  {
    slug: "nursing",
    name: "Nursing and healthcare candidate",
    fullName: "Priya Thomas",
    currentRole: "Staff Nurse",
    education: "GNM Nursing, St. John's College of Nursing, 2024",
    titles: ["Staff Nurse", "Registered Nurse", "Nursing Officer"],
    skills: ["Patient care", "GNM", "Nursing", "Ward care"],
    locations: ["Hyderabad", "Bengaluru", "India"],
    experience: 1,
    sector: "BOTH",
    salaryMin: 300000,
    format: "docx",
  },
  {
    slug: "education",
    name: "Teacher and education candidate",
    fullName: "Neha Verma",
    currentRole: "Secondary School Teacher",
    education: "B.Ed Mathematics, Bangalore University, 2022",
    titles: ["Teacher", "Lecturer", "Academic Coordinator"],
    skills: ["Teaching", "Curriculum", "BEd", "Classroom management"],
    locations: ["Bengaluru", "Remote", "India"],
    experience: 2,
    sector: "BOTH",
    salaryMin: 400000,
    format: "text",
  },
  {
    slug: "sales-marketing",
    name: "Sales and marketing professional",
    fullName: "Rahul Kapoor",
    currentRole: "Sales Executive",
    education: "BBA Marketing, Amity University, 2021",
    titles: ["Sales Executive", "Marketing Executive", "Business Development Executive"],
    skills: ["Sales", "CRM", "Digital marketing", "Lead generation"],
    locations: ["Delhi", "Gurugram", "India"],
    experience: 3,
    sector: "PRIVATE",
    salaryMin: 550000,
    format: "pdf",
  },
];

const requestedIndex = Number(process.env.TEN_PERSONA_INDEX);
const selectedPersonas = Number.isInteger(requestedIndex)
  ? PERSONAS.slice(requestedIndex, requestedIndex + 1)
  : PERSONAS;

test.describe.configure({ mode: "serial" });

function accountFor(persona: Persona) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    fullName: persona.fullName,
    email: `qa.ten-persona-${persona.slug}.${nonce}@jobagent-e2e.test`,
    password:
      process.env.E2E_EPHEMERAL_PASSWORD ??
      `Kairela_${nonce}_Strong9!`,
  };
}

function realisticResume(persona: Persona): string {
  const endYear = 2026 - Math.max(0, persona.experience);
  return `${persona.fullName}
${persona.currentRole} | ${persona.locations[0]}, India | ${persona.slug}@example.com

PROFESSIONAL SUMMARY
${persona.currentRole} with ${persona.experience} years of relevant experience. Seeking ${persona.titles.join(
    " or "
  )} opportunities in India.

EXPERIENCE
${persona.currentRole} | Verified Example Organization | ${endYear} - Present
- Used ${persona.skills.slice(0, 2).join(" and ")} in day-to-day work.
- Coordinated documented tasks, stakeholder updates, and quality checks.
- Followed established procedures and recorded outcomes accurately.

EDUCATION
${persona.education}

SKILLS
${persona.skills.join(", ")}

TARGET ROLES
${persona.titles.join(", ")}
`;
}

async function makePdf(page: Page, text: string): Promise<Buffer> {
  // Chromium's print pipeline preserves paragraph boundaries in the PDF text
  // layer. Drawing isolated glyph runs with pdf-lib looks correct visually but
  // some extractors legitimately flatten every run into one line, turning the
  // fixture itself into a poor test of Kairela's structured parser.
  const printPage = await page.context().newPage();
  try {
    await printPage.setContent(
      "<!doctype html><html><body><pre id=\"resume\" style=\"font: 12px/1.45 Arial; white-space: pre-wrap\"></pre></body></html>"
    );
    await printPage.locator("#resume").evaluate(
      (element, resumeText) => {
        element.textContent = resumeText;
      },
      text
    );
    return await printPage.pdf({
      format: "A4",
      margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      printBackground: true,
    });
  } finally {
    await printPage.close();
  }
}

async function makeDocx(text: string): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const escapeXml = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const paragraphs = text
    .split("\n")
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
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

async function completeSignup(
  page: Page,
  account: ReturnType<typeof accountFor>,
  gateFailures: string[]
) {
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(account.fullName);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create Account" }).click();

  const outcome = await Promise.race([
    page
      .waitForURL(/\/verify-email/, { timeout: 45000 })
      .then(() => "verify" as const),
    page
      .getByRole("heading", { name: "Signup failed" })
      .waitFor({ state: "visible", timeout: 45000 })
      .then(() => "failed" as const),
  ]).catch(() => "timeout" as const);

  if (outcome === "verify") {
    await confirmUserByEmail(account.email);
    return;
  }

  const errorText =
    outcome === "failed"
      ? await page.getByRole("alert").innerText().catch(() => "Signup failed")
      : "Signup did not reach email verification within 45 seconds";
  gateFailures.push(`UI signup: ${errorText.replace(/\s+/g, " ").slice(0, 240)}`);

  // Continue the remaining browser journey without weakening the final
  // verdict. This server-only fallback is intentionally recorded as a failed
  // gate; it exists so one provider throttle does not hide downstream product
  // failures in the same persona.
  try {
    await confirmUserByEmail(account.email);
  } catch {
    await createConfirmedUser(account);
  }
}

async function login(page: Page, account: ReturnType<typeof accountFor>) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60000 });
}

async function uploadResume(page: Page, persona: Persona) {
  const resume = realisticResume(persona);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/resumes/master") &&
      response.request().method() === "POST"
  );
  if (persona.format === "text") {
    await page
      .getByRole("button", { name: /Or paste your resume text/i })
      .click();
    await page.getByLabel(/Paste your resume text/i).fill(resume);
    await page
      .getByRole("button", { name: /Extract details from pasted text/i })
      .click();
  } else {
    const buffer =
      persona.format === "pdf"
        ? await makePdf(page, resume)
        : await makeDocx(resume);
    await page.getByLabel("Choose a resume file to upload").setInputFiles({
      name: `${persona.slug}.${persona.format}`,
      mimeType:
        persona.format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    });
  }
  const response = await responsePromise;
  expect(response.ok(), `Resume upload failed with ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as {
    profile?: { fullName?: { value?: string }; skills?: { value?: string[] } };
    atsScore?: { totalScore?: number };
  };
  expect(body.profile?.fullName?.value).toBeTruthy();
  expect(body.profile?.skills?.value?.length ?? 0).toBeGreaterThan(0);
  expect(typeof body.atsScore?.totalScore).toBe("number");
}

async function addChipIfVisible(page: Page, label: string, value: string) {
  const input = page.getByLabel(`Add to ${label}`);
  if (await input.isVisible().catch(() => false)) {
    await input.fill(value);
    await input.press("Enter");
  }
}

async function finishOnboarding(page: Page, persona: Persona) {
  await expect(page).toHaveURL(/\/dashboard\/onboarding/, { timeout: 60000 });
  const jobSeeker = page.getByRole("button", { name: /Find my next job/i });
  await jobSeeker.waitFor({ state: "visible", timeout: 60000 });
  await jobSeeker.click();
  await expect(
    page.getByRole("heading", { name: "Start with your resume" })
  ).toBeVisible({ timeout: 30000 });

  await uploadResume(page, persona);
  await expect(
    page.getByRole("heading", { name: "We found these details" })
  ).toBeVisible({ timeout: 30000 });

  const editedName = `${persona.fullName} E2E`;
  await page.locator("#review-fullName").fill(editedName);
  await addChipIfVisible(page, "Target job titles", persona.titles[0]);
  await page.getByRole("button", { name: /Looks good, continue/i }).click();

  await expect(
    page.getByRole("heading", { name: /Tell us what your resume can't/i })
  ).toBeVisible({ timeout: 60000 });
  await addChipIfVisible(page, "Target job titles", persona.titles[0]);
  await addChipIfVisible(page, "Skills", persona.skills[0]);
  const experience = page.getByLabel("Years of experience");
  if (await experience.isVisible().catch(() => false)) {
    await experience.fill(String(persona.experience));
  }
  await addChipIfVisible(page, "Preferred locations", persona.locations[0]);
  const remote = page.getByRole("button", { name: "Remote", exact: true });
  if ((await remote.getAttribute("aria-pressed")) !== "true") {
    await remote.click();
  }
  if (persona.salaryMin != null) {
    const salaryMin = page.getByLabel("Salary min");
    if (await salaryMin.isVisible().catch(() => false)) {
      await salaryMin.fill(String(persona.salaryMin));
    }
  }

  await page.getByRole("button", { name: /^Continue$/i }).click();
  const goToDashboard = page.getByRole("button", { name: /Go to dashboard/i });
  await goToDashboard.waitFor({ state: "visible", timeout: 60000 });
  const completion = page.waitForResponse(
    (response) =>
      response.url().includes("/api/onboarding") &&
      response.request().method() === "PUT"
  );
  await goToDashboard.click();
  expect((await completion).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard\/jobs/, { timeout: 60000 });
}

async function saveSectorAndVerifyPreferences(page: Page, persona: Persona) {
  await page.goto("/dashboard/settings");
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/settings") &&
      response.request().method() === "PUT"
  );
  await page.getByLabel("Job sector").selectOption(persona.sector);
  await page.getByRole("button", { name: /Save Settings/i }).click();
  expect((await saveResponse).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Job sector")).toHaveValue(persona.sector);
  await expect(
    page.getByRole("list", { name: "Locations" }).getByText(persona.locations[0])
  ).toBeVisible();
}

async function saveReusableAnswer(page: Page) {
  await page.goto("/dashboard/answers");
  await expect(
    page.getByRole("heading", { name: "Application answer bank" })
  ).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Application field").selectOption("notice_period");
  await page.getByLabel("Confirmed value").fill("30 days");
  await page.getByLabel("I confirm this value is accurate").check();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/answer-bank") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save answer" }).click();
  expect((await saveResponse).ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Notice period" })
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible({
    timeout: 60000,
  });
}

async function waitForSearch(page: Page): Promise<{
  final: SearchProgress;
  sawProgressiveCount: boolean;
}> {
  const deadline = Date.now() + 8 * 60_000;
  let sawProgressiveCount = false;
  let last: SearchProgress | null = null;
  while (Date.now() < deadline) {
    const response = await page.request.get("/api/jobs/progress?type=SEARCH_JOBS");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { progress?: SearchProgress | null };
    if (body.progress) {
      last = body.progress;
      if (
        body.progress.status !== "completed" &&
        body.progress.jobsFound > 0
      ) {
        sawProgressiveCount = true;
      }
      if (
        ["completed", "failed", "cancelled"].includes(body.progress.status)
      ) {
        return { final: body.progress, sawProgressiveCount };
      }
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(
    `Search did not finish within 8 minutes. Last progress: ${JSON.stringify(last)}`
  );
}

async function runSearchAndVerifyEvidence(page: Page) {
  await page.goto("/dashboard/jobs");
  const settingsResponse = await page.request.get("/api/settings");
  const settingsBody = (await settingsResponse.json()) as {
    jobTitles?: string[];
    requiredSkills?: string[];
    locations?: string[];
    workModes?: string[];
    experienceYears?: number | null;
  };
  expect(
    settingsResponse.ok(),
    `Could not read settings before search: ${JSON.stringify(settingsBody)}`
  ).toBeTruthy();
  const missing = [
    ...(settingsBody.jobTitles?.length ? [] : ["job titles"]),
    ...(settingsBody.requiredSkills?.length ? [] : ["primary skills"]),
    ...(settingsBody.locations?.length ||
    settingsBody.workModes?.includes("REMOTE")
      ? []
      : ["locations or remote preference"]),
    ...(settingsBody.experienceYears != null ? [] : ["years of experience"]),
  ];
  expect(
    missing,
    `Persisted search settings are incomplete: ${JSON.stringify(settingsBody)}`
  ).toEqual([]);

  const startResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/jobs/search") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /^Run Job Search$/i }).click();
  const started = await startResponse;
  const startBody = await started.text();
  expect(
    started.ok(),
    `Job search start failed with ${started.status()}: ${startBody}`
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: /Searching/i })
  ).toBeVisible({ timeout: 15000 });

  const result = await waitForSearch(page);
  expect(result.final.status).toBe("completed");
  expect(result.final.result?.sources?.length ?? 0).toBeGreaterThan(0);
  expect(result.final.result?.searchStageCounts).toBeTruthy();

  await page.reload();
  if (result.final.jobsRelevant > 0) {
    await expect(
      page.getByLabel("Completed search evidence")
    ).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Exact search:/i)).toBeVisible();
    await expect(page.getByText(/Source results/i)).toBeVisible();
  } else {
    await expect(
      page.getByText(/no jobs passed your current filters/i)
    ).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Exact search:/i)).toBeVisible();
    await expect(page.getByText(/Queries tested/i)).toBeVisible();
    await expect(page.getByText(/Source results/i)).toBeVisible();
  }
  return result;
}

async function firstJobCard(page: Page) {
  let card = page.locator('[data-testid^="job-card-"]').first();
  if (!(await card.isVisible().catch(() => false))) {
    await page.goto("/dashboard/jobs?view=possible");
    card = page.locator('[data-testid^="job-card-"]').first();
  }
  return card;
}

async function verifyJobApplicationFlow(
  page: Page,
  gateFailures: string[]
) {
  const card = await firstJobCard(page);
  await expect(card).toBeVisible({ timeout: 60000 });
  const title = (await card.locator("h3").first().innerText()).trim();
  const original = card.getByRole("link", {
    name: /Open original posting/i,
  });
  const href = await original.getAttribute("href");
  expect(href).toBeTruthy();
  const canonical = new URL(href!);
  expect(canonical.protocol).toBe("https:");
  expect(canonical.hostname).toBeTruthy();

  const popupPromise = page.waitForEvent("popup");
  await original.click();
  const popup = await popupPromise;
  await expect
    .poll(() => popup.url(), { timeout: 15000 })
    .not.toBe("about:blank");
  await popup.close();

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/disposition") &&
      response.request().method() === "PUT"
  );
  await card.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saveResponse).ok()).toBeTruthy();
  await expect(card.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  const generate = card.getByRole("button", { name: "Generate docs", exact: true });
  await expect(generate).toBeVisible();
  const generateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/jobs/process") &&
      response.request().method() === "POST",
    { timeout: 180000 }
  );
  await generate.click();
  const generated = await generateResponse;
  const generatedBody = await generated.text();
  expect(
    generated.ok(),
    `Tailored document generation failed with ${generated.status()}: ${generatedBody}`
  ).toBeTruthy();

  await page.goto("/dashboard/applications");
  await expect(
    page.getByText(/ATS score \(original.*tailored\)/i).first()
  ).toBeVisible({ timeout: 60000 });
  const row = page.locator("tr", { hasText: title }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText(/\d+\s*→\s*\d+/)).toBeVisible();

  const prepareResponse = page.waitForResponse(
    (response) =>
      /\/api\/applications\/[^/]+$/.test(new URL(response.url()).pathname) &&
      response.request().method() === "POST",
    { timeout: 120000 }
  );
  await row.getByRole("button", { name: "Prepare", exact: true }).click();
  const prepared = await prepareResponse;
  expect(
    prepared.ok(),
    `Dry-run application preparation failed with ${prepared.status()}`
  ).toBeTruthy();

  await page.goto("/dashboard/answers");
  const answerCard = page
    .getByRole("heading", { name: "Notice period" })
    .locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
  await expect(page.getByRole("heading", { name: "Notice period" })).toBeVisible();
  const usageText = await answerCard.innerText().catch(() => "");
  if (!/Applications\s+[1-9]\d*/i.test(usageText)) {
    gateFailures.push(
      "Answer-bank reuse was not recorded after dry-run preparation."
    );
  }

  return { title, canonicalUrl: href! };
}

async function verifyPersistenceAndMobile(
  page: Page,
  account: ReturnType<typeof accountFor>,
  persona: Persona,
  expectsJobArtifacts: boolean
) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/, { timeout: 60000 });
  await login(page, account);

  await page.goto("/dashboard/settings");
  await expect(page.getByLabel("Job sector")).toHaveValue(persona.sector);
  await expect(
    page.getByRole("list", { name: "Locations" }).getByText(persona.locations[0])
  ).toBeVisible();
  if (expectsJobArtifacts) {
    await page.goto("/dashboard/jobs?view=saved");
    await expect(page.locator('[data-testid^="job-card-"]').first()).toBeVisible({
      timeout: 60000,
    });
    await page.goto("/dashboard/resumes");
    await expect(page.getByText(/Tailored Resumes \([1-9]\d*\)/i)).toBeVisible();
  } else {
    await page.goto("/dashboard/resumes");
    await expect(
      page.getByRole("heading", { name: "Master Resume" }).first()
    ).toBeVisible();
  }

  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(
    expectsJobArtifacts ? "/dashboard/jobs?view=saved" : "/dashboard/jobs"
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
  await expect(
    page.getByRole("navigation", { name: /Tab navigation/i })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /More navigation/i })
  ).toBeVisible();
  if (expectsJobArtifacts) {
    await expect(page.locator('[data-testid^="job-card-"]').first()).toBeVisible();
  }
}

async function assertAccountRemoved(email: string) {
  const admin = getAdminClient();
  const [authResult, applicationResult] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("users").select("id").eq("email", email),
  ]);
  if (authResult.error) throw authResult.error;
  if (applicationResult.error) throw applicationResult.error;
  expect(authResult.data.users.some((user) => user.email === email)).toBe(false);
  expect(applicationResult.data).toHaveLength(0);
}

for (const [personaIndex, persona] of selectedPersonas.entries()) {
  test(`${personaIndex + 1}. ${persona.name} completes the strict production journey`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The journey includes its own 393px mobile pass.");
    test.setTimeout(15 * 60_000);
    const account = accountFor(persona);
    const gateFailures: string[] = [];
    const evidence: Record<string, unknown> = {
      persona: persona.name,
      resumeFormat: persona.format,
      sector: persona.sector,
    };

    try {
      await test.step("1-2. Create an ephemeral account and complete signup", async () => {
        await completeSignup(page, account, gateFailures);
        await login(page, account);
      });

      await test.step("3-6. Upload, extract, edit, and complete resume-first onboarding", async () => {
        await finishOnboarding(page, persona);
      });

      await test.step("7-9. Persist sector, locations, salary, and a reusable answer", async () => {
        await saveSectorAndVerifyPreferences(page, persona);
        await saveReusableAnswer(page);
      });

      const search = await test.step("10-16. Run strict, balanced, and recovery search with diagnostics", async () => {
        const result = await runSearchAndVerifyEvidence(page);
        evidence.search = {
          relevant: result.final.jobsRelevant,
          found: result.final.jobsFound,
          excluded: result.final.jobsExcluded,
          progressive: result.sawProgressiveCount,
          stages: result.final.result?.searchStageCounts,
          sources: result.final.result?.sources,
        };
        if (!result.sawProgressiveCount && result.final.jobsFound > 0) {
          gateFailures.push(
            "No job count was observed before the search reached completed state."
          );
        }
        if (result.final.jobsRelevant === 0) {
          const reviewFilters = page.getByRole("link", { name: /Review filters/i });
          await reviewFilters.click();
          await expect(page).toHaveURL(/\/dashboard\/settings/);
          await page.goto("/dashboard/jobs");
        }
        return result;
      });

      let jobEvidence: { title: string; canonicalUrl: string } | null = null;
      await test.step("17-23. Open and save a real job, tailor, ATS-score, and prepare a dry run", async () => {
        if (search.final.jobsRelevant === 0) {
          gateFailures.push(
            "No relevant job was available for canonical-link, save, tailoring, ATS, and dry-run application gates."
          );
          return;
        }
        jobEvidence = await verifyJobApplicationFlow(page, gateFailures);
        evidence.job = jobEvidence;
      });

      await test.step("24-27. Logout, login, verify persistence, and test 393px mobile", async () => {
        await verifyPersistenceAndMobile(
          page,
          account,
          persona,
          search.final.jobsRelevant > 0 && Boolean(jobEvidence)
        );
      });

      console.log(
        `TEN_PERSONA_EVIDENCE ${JSON.stringify({
          ...evidence,
          gateFailures,
        })}`
      );
      expect(gateFailures, `${persona.name} strict gate failures`).toEqual([]);
    } finally {
      await test.step("28. Remove the ephemeral account and all owned records", async () => {
        await deleteUserByEmail(account.email);
        await assertAccountRemoved(account.email);
      });
    }
  });
}
