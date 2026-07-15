import { defineConfig, devices } from "@playwright/test";

const useDevServer = process.env.PLAYWRIGHT_LANDING_DEV === "1";
const localURL = useDevServer ? "http://localhost:3100" : "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "landing-page.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report/landing", open: "never" }], ["list"]],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: localURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: useDevServer ? "npm run dev -- -p 3100" : "npm run start -- -p 3100",
    url: localURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
