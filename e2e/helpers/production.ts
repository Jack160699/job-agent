/** Canonical production deployment — all E2E tests MUST target this URL. */
export const PRODUCTION_URL = "https://job-agent-mu-steel.vercel.app";

export function getProductionBaseUrl(): string {
  const url = process.env.PLAYWRIGHT_BASE_URL || PRODUCTION_URL;
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    throw new Error(
      `E2E tests must run against production. Got: ${url}. ` +
        `Set PLAYWRIGHT_BASE_URL=${PRODUCTION_URL}`
    );
  }
  return url.replace(/\/$/, "");
}
