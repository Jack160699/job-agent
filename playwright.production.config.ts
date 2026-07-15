import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "landing-production.spec.ts",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report/production", open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PRODUCTION_URL || "https://job-agent-mu-steel.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
