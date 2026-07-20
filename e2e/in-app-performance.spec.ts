import { expect, test } from "@playwright/test";
import { loginWithSharedAccount } from "./helpers/auth";

type ClientSample = {
  from: string;
  to: string;
  clickFeedbackMs: number | null;
  routeCommitMs: number;
  firstUsefulContentMs: number;
  loadingBoundaryMs: number | null;
  capturedAt: string;
};

function summarize(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (percentile: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)];
  return {
    min: sorted[0],
    median: at(0.5),
    p75: at(0.75),
    p95: at(0.95),
    max: sorted.at(-1),
    samples: sorted.length,
  };
}

test("measures ten real prefetched in-app transitions and immediate click feedback", async ({
  page,
}, testInfo) => {
  test.setTimeout(4 * 60_000);
  await loginWithSharedAccount(page);
  await expect(page.locator("[data-navigation-feedback]")).toBeAttached();
  await expect
    .poll(
      () =>
        page.evaluate(() => Boolean(window.__KAIRELA_PERFORMANCE__)),
      { timeout: 10_000 }
    )
    .toBe(true);

  const routes = [
    "/dashboard/jobs",
    "/dashboard/resumes",
    "/dashboard/applications",
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/resumes",
    "/dashboard/applications",
    "/dashboard",
    "/dashboard/jobs",
    "/dashboard/resumes",
  ];

  const baselineSamples = await page.evaluate(
    () => window.__KAIRELA_PERFORMANCE__?.samples.length ?? 0
  );
  for (const [index, route] of routes.entries()) {
    const link = page.locator(`a[href="${route}"]:visible`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`), {
      timeout: 15_000,
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__KAIRELA_PERFORMANCE__?.samples.length ?? 0
          ),
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(baselineSamples + index + 1);
  }

  const samples = await page.evaluate(
    () => window.__KAIRELA_PERFORMANCE__?.samples.slice(-10) ?? []
  );
  expect(samples).toHaveLength(10);
  const feedback = (samples as ClientSample[])
    .map((sample) => sample.clickFeedbackMs)
    .filter((value): value is number => value != null);
  expect(feedback).toHaveLength(10);
  expect(Math.max(...feedback)).toBeLessThan(100);

  const report = {
    project: testInfo.project.name,
    measuredAt: new Date().toISOString(),
    method:
      "Same-origin Next.js Link click to route commit and two animation frames after commit",
    click_feedback_ms: summarize(feedback),
    route_commit_ms: summarize(
      (samples as ClientSample[]).map((sample) => sample.routeCommitMs)
    ),
    first_useful_content_ms: summarize(
      (samples as ClientSample[]).map((sample) => sample.firstUsefulContentMs)
    ),
  };
  console.log(`IN_APP_PERF_JSON ${JSON.stringify(report)}`);
  await testInfo.attach("in-app-performance.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
});

test("liveness and readiness expose separate server timing", async ({ page }) => {
  if (process.env.VERCEL_SHARE_URL) {
    await page.goto(process.env.VERCEL_SHARE_URL);
  }
  const live = await page.request.get("/api/live");
  const ready = await page.request.get("/api/health");
  expect(live.ok()).toBe(true);
  expect(ready.ok()).toBe(true);
  const liveTiming =
    live.headers()["server-timing"] ??
    live.headers()["x-kairela-server-timing"];
  const readyTiming =
    ready.headers()["server-timing"] ??
    ready.headers()["x-kairela-server-timing"];
  expect(liveTiming).toContain("total");
  expect(readyTiming).toContain("database");
});
