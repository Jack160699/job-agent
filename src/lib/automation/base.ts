import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { DiscoveredJob } from "@/lib/jobs/types";

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
  snapshot: { elements: Array<{ ref: string; role: string; name: string }> },
  patterns: RegExp[]
) {
  return snapshot.elements.find((el) =>
    patterns.some((p) => p.test(el.name) || p.test(el.role))
  );
}

export async function fillCommonFields(
  browser: BrowserAutomationClient,
  profile: ApplicationProfile
) {
  const fields = [
    { label: "First Name", value: profile.fullName.split(" ")[0] || profile.fullName },
    { label: "Last Name", value: profile.fullName.split(" ").slice(1).join(" ") || "-" },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone || "" },
    { label: "LinkedIn", value: profile.linkedinUrl || "" },
    { label: "Location", value: profile.location || "" },
  ].filter((f) => f.value);

  await browser.fill(fields);
}
