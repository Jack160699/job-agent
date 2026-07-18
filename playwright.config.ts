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
    {
      // Samsung Galaxy S23 FE: 393x852 CSS px @ 2.75x DPR, matching the
      // device's actual rendered viewport (not a Playwright built-in
      // preset, so specified explicitly).
      name: "samsung-s23-fe",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; SM-S711B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      },
    },
  ],
});
