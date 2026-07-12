import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { DiscoveredJob } from "@/lib/jobs/types";
import { findElementWithFallbacks } from "./resilient";

export interface PlatformAutomator {
  platform: string;
  canHandle(url: string): boolean;
  discoverJobs(boardSlug: string, query: string): Promise<DiscoveredJob[]>;
  prepareApplication(
    browser: BrowserAutomationClient,
    jobUrl: string,
    profile: ApplicationProfile,
    documents: ApplicationDocuments,
    options?: { autoSubmit?: boolean }
  ): Promise<SubmissionResult>;
}

export function findElement(
  snapshot: { elements: Array<{ ref: string; role: string; name: string; tag?: string; type?: string }> },
  patterns: RegExp[],
  fallbacks: RegExp[] = []
) {
  return findElementWithFallbacks(snapshot, patterns, fallbacks);
}

export async function fillCommonFields(
  browser: BrowserAutomationClient,
  profile: ApplicationProfile
) {
  const snap = await browser.snapshot();
  const first = profile.fullName.split(" ")[0] || profile.fullName;
  const last = profile.fullName.split(" ").slice(1).join(" ") || "-";

  const mappings: Array<{ patterns: RegExp[]; value: string }> = [
    { patterns: [/first name/i], value: first },
    { patterns: [/last name/i], value: last },
    { patterns: [/email/i], value: profile.email },
    { patterns: [/phone/i], value: profile.phone || "" },
    { patterns: [/linkedin/i], value: profile.linkedinUrl || "" },
    { patterns: [/location/i], value: profile.location || "" },
  ];

  for (const { patterns, value } of mappings) {
    if (!value) continue;
    const el = findElementWithFallbacks(snap, patterns);
    if (el) {
      try {
        await browser.type(el.ref, value);
      } catch {
        await browser.fill([{ ref: el.ref, value }]);
      }
    }
  }
}
