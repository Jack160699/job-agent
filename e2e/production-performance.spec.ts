import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginWithSharedAccount } from "./helpers/auth";

type Sample = {
  min: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
  samples: number;
};

function summarize(values: number[]): Sample {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (value: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
  return {
    min: sorted[0],
    median: percentile(0.5),
    p75: percentile(0.75),
    p95: percentile(0.95),
    max: sorted.at(-1)!,
    samples: sorted.length,
  };
}

async function measurePage(page: Page, path: string): Promise<number> {
  const startedAt = performance.now();
  const response = await page.goto(path, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).toBeVisible();
  return Math.round(performance.now() - startedAt);
}

async function measureApi(
  request: APIRequestContext,
  path: string
): Promise<number> {
  const startedAt = performance.now();
  const response = await request.get(path);
  expect(response.ok()).toBe(true);
  return Math.round(performance.now() - startedAt);
}

test("records privacy-safe production navigation and API latency samples", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(5 * 60_000);
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("Ephemeral performance user was not provisioned");
  }

  const measurements: Record<string, Sample> = {};
  const publicHome: number[] = [];
  const livenessApi: number[] = [];
  const healthApi: number[] = [];
  for (let index = 0; index < 5; index++) {
    publicHome.push(await measurePage(page, "/"));
    livenessApi.push(await measureApi(request, "/api/live"));
    healthApi.push(await measureApi(request, "/api/health"));
  }
  measurements.public_home_dom_ready_ms = summarize(publicHome);
  measurements.liveness_api_ms = summarize(livenessApi);
  measurements.health_api_ms = summarize(healthApi);

  const loginStartedAt = performance.now();
  await loginWithSharedAccount(page);
  measurements.login_to_dashboard_ms = summarize([
    Math.round(performance.now() - loginStartedAt),
  ]);

  for (const [name, path] of [
    ["dashboard", "/dashboard"],
    ["jobs", "/dashboard/jobs"],
    ["sources", "/dashboard/sources"],
    ["resumes", "/dashboard/resumes"],
    ["settings", "/dashboard/settings"],
  ] as const) {
    const samples: number[] = [];
    for (let index = 0; index < 5; index++) {
      samples.push(await measurePage(page, path));
    }
    measurements[`${name}_dom_ready_ms`] = summarize(samples);
  }

  const progressApi: number[] = [];
  for (let index = 0; index < 5; index++) {
    progressApi.push(
      await measureApi(page.request, "/api/jobs/progress?type=SEARCH_JOBS")
    );
  }
  measurements.authenticated_progress_api_ms = summarize(progressApi);

  console.log(
    `PERF_JSON ${JSON.stringify({
      project: testInfo.project.name,
      baseURL: testInfo.project.use.baseURL,
      measuredAt: new Date().toISOString(),
      method: "Playwright navigation to DOMContentLoaded plus visible body; API response elapsed time",
      measurements,
    })}`
  );
});
