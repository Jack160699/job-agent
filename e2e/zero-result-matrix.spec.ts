import { expect, test } from "@playwright/test";
import type { Prisma } from "@prisma/client";
import {
  buildZeroResultDiagnosis,
  type DiagnosisInput,
} from "../src/lib/jobs/diagnostics";
import { prisma } from "../src/lib/db";
import { getSharedE2ECredentials, loginWithSharedAccount } from "./helpers/auth";

type MatrixCase = {
  name: string;
  input: DiagnosisInput;
  expected: RegExp;
};

const responded = [
  {
    source: "GREENHOUSE",
    requested: true,
    success: true,
    fetched: 0,
    invalid: 0,
    duplicates: 0,
    expired: 0,
    relevant: 0,
  },
];

function input(overrides: Partial<DiagnosisInput>): DiagnosisInput {
  return {
    discovered: 0,
    excludedCount: 0,
    duplicates: 0,
    filterImpact: {},
    sources: responded,
    plan: { titles: ["Operations Analyst"], locations: ["Pune"] },
    ...overrides,
  };
}

const cases: MatrixCase[] = [
  { name: "Exact title too narrow", input: input({ discovered: 8, excludedCount: 8, filterImpact: { title_mismatch: 8 } }), expected: /target roles/i },
  { name: "Preferred city unavailable", input: input({ discovered: 7, excludedCount: 7, filterImpact: { location_mismatch: 7 } }), expected: /preferred locations/i },
  { name: "Minimum salary too high", input: input({ discovered: 4, excludedCount: 4, filterImpact: { salary_below_minimum: 4 } }), expected: /minimum/i },
  { name: "Experience mismatch", input: input({ discovered: 6, excludedCount: 6, filterImpact: { experience_mismatch: 6 } }), expected: /experience/i },
  { name: "All selected sources failed", input: input({ sources: [{ source: "GREENHOUSE", success: false, fetched: 0 }, { source: "LEVER", success: false, fetched: 0 }] }), expected: /all 2 job sources failed/i },
  { name: "LinkedIn unavailable", input: input({ sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "not configured" }, ...responded] }), expected: /linkedin public discovery is not configured/i },
  { name: "Naukri unavailable", input: input({ sources: [{ source: "NAUKRI", success: false, fetched: 0, error: "setup_required" }, ...responded] }), expected: /naukri public discovery is not configured/i },
  { name: "Provider rate limited", input: input({ sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "provider rate limited" }, ...responded] }), expected: /rate limited/i },
  { name: "Provider quota exhausted", input: input({ sources: [{ source: "NAUKRI", success: false, fetched: 0, error: "quota exhausted" }, ...responded] }), expected: /quota/i },
  { name: "ATS board timeout", input: input({ sources: [{ source: "WORKDAY", success: false, fetched: 0, error: "timed out" }, ...responded] }), expected: /safe timeout/i },
  { name: "Government deadline expired", input: input({ discovered: 3, excludedCount: 3, filterImpact: { expired_or_removed: 3 } }), expected: /expired/i },
  { name: "Qualification mismatch", input: input({ discovered: 2, excludedCount: 2, filterImpact: { qualification_mismatch: 2 } }), expected: /qualification/i },
  { name: "Duplicate-only results", input: input({ discovered: 5, duplicates: 5 }), expected: /duplicates/i },
  { name: "No recent jobs", input: input({ discovered: 9, excludedCount: 9, filterImpact: { stale_posting: 9 } }), expected: /old/i },
  { name: "Excluded keyword removed everything", input: input({ discovered: 5, excludedCount: 5, filterImpact: { excluded_keyword: 5 } }), expected: /excluded keyword/i },
  { name: "Authenticated source disconnected", input: input({ sources: [{ source: "LINKEDIN", success: false, fetched: 0, error: "authenticated connection required" }, ...responded] }), expected: /authenticated connection/i },
  { name: "Target title missing", input: input({ plan: { titles: [], locations: ["Pune"] } }), expected: /no target role/i },
  { name: "Location missing", input: input({ plan: { titles: ["Teacher"], locations: [] } }), expected: /no preferred location/i },
  { name: "Government category too narrow", input: input({ plan: { titles: ["Government archaeology officer"], locations: ["India"] } }), expected: /no current postings/i },
  { name: "Healthcare market empty in selected city", input: input({ plan: { titles: ["Staff Nurse"], locations: ["Panaji"] } }), expected: /staff nurse.*panaji/i },
];

test("renders, persists, and recovers from all 20 zero-result cases", async ({
  page,
}, testInfo) => {
  test.setTimeout(8 * 60_000);
  const { email } = getSharedE2ECredentials();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await loginWithSharedAccount(page);

  try {
    for (const [index, matrixCase] of cases.entries()) {
      const diagnosis = buildZeroResultDiagnosis(matrixCase.input);
      const sources = matrixCase.input.sources.map((source) => ({
        ...source,
        requested: source.requested !== false,
        invalid: 0,
        duplicates: 0,
        expired: 0,
        relevant: 0,
      }));
      await prisma.backgroundJob.create({
        data: {
          userId: user.id,
          type: "SEARCH_JOBS",
          source: "e2e_zero_matrix",
          status: "completed",
          progressStage: "completed",
          progressPercent: 100,
          startedAt: new Date(),
          completedAt: new Date(),
          progressMeta: {
            label: "Complete",
            rawCount: matrixCase.input.discovered,
            discovered: matrixCase.input.discovered,
            relevant: 0,
            new: 0,
            excluded: matrixCase.input.excludedCount,
            duplicates: matrixCase.input.duplicates,
            sources,
            filterImpact: matrixCase.input.filterImpact,
            zeroResultDiagnosis: diagnosis,
            searchSummary: {
              queriesGenerated: (matrixCase.input.plan?.titles ?? []).map(
                (title) => ({
                  title,
                  location: matrixCase.input.plan?.locations[0] ?? null,
                })
              ),
              sources: sources.map((source) => source.source),
            },
            fixture: {
              environment: "ephemeral_e2e_record",
              case: matrixCase.name,
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await page.goto("/dashboard/jobs");
      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              "/api/jobs/progress?type=SEARCH_JOBS"
            );
            const body = await response.json();
            return body.progress?.result?.fixture?.case;
          },
          { timeout: 20_000 }
        )
        .toBe(matrixCase.name);
      await expect(
        page.getByText(/Search complete.*no jobs passed your current filters/i)
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(matrixCase.expected).first()).toBeVisible();
      await expect(page.getByText("Queries tested")).toBeVisible();
      await expect(page.getByText("Source results")).toBeVisible();
      await expect(page.getByText(/Search complete.*relevant jobs found/i)).toHaveCount(0);

      const recoveryLinks = page
        .locator('a[href^="/dashboard/"]')
        .filter({
          hasText:
            /Add remote|Broaden role|Review minimum|Review search|Review resume|Review source|View existing/i,
        });
      if ((await recoveryLinks.count()) > 0) {
        await expect(recoveryLinks.first()).toBeVisible();
      } else {
        await expect(
          page.getByRole("button", {
            name: /Retry available sources/i,
          })
        ).toBeVisible();
      }
      await page.reload();
      await expect(page.getByText(matrixCase.expected).first()).toBeVisible({
        timeout: 20_000,
      });

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(overflow, `${matrixCase.name} overflowed in ${testInfo.project.name}`).toBe(
        false
      );
      console.log(`ZERO_MATRIX_PASS ${index + 1}/20 ${matrixCase.name}`);
    }
  } finally {
    await prisma.backgroundJob.deleteMany({
      where: { userId: user.id, source: "e2e_zero_matrix" },
    });
  }
});
