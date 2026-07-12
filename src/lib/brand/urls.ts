import { BRAND, FALLBACK_PRODUCTION_URL } from "./config";

const LOCAL_ORIGIN = "http://localhost:3000";

/** Allowed production hosts (canonical + Vercel fallback). */
export const PRODUCTION_HOSTS = [
  BRAND.domain,
  `www.${BRAND.domain}`,
  "job-agent-mu-steel.vercel.app",
] as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Canonical site origin for metadata, OAuth redirects, and email links.
 * Prefers NEXT_PUBLIC_CANONICAL_URL, then NEXT_PUBLIC_APP_URL, then Vercel URL.
 */
export function getCanonicalOrigin(): string {
  const canonical = process.env.NEXT_PUBLIC_CANONICAL_URL;
  if (canonical) return stripTrailingSlash(canonical);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return stripTrailingSlash(appUrl);

  if (process.env.NODE_ENV === "production") {
    return `https://${BRAND.domain}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return LOCAL_ORIGIN;
}

/** Runtime app base URL for server-side fetch callbacks (worker, cron). */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === "production") {
    return FALLBACK_PRODUCTION_URL;
  }
  return LOCAL_ORIGIN;
}

export function getGoogleOAuthRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${getAppBaseUrl()}/api/google/callback`
  );
}

export function isAllowedProductionHost(hostname: string): boolean {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  return PRODUCTION_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(".vercel.app")
  );
}

export function shouldRedirectWwwToApex(hostname: string): boolean {
  return hostname.toLowerCase() === `www.${BRAND.domain}`;
}
