import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PRODUCTION_URL } from "./e2e/helpers/production";

const envPath = resolve(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || PRODUCTION_URL;

if (baseURL.includes("localhost") || baseURL.includes("127.0.0.1")) {
  throw new Error(
    `Playwright must target production (${PRODUCTION_URL}). Current: ${baseURL}`
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.RC_AUDIT === "1" ? 0 : 2,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
