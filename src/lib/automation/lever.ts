import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { PlatformAutomator } from "./base";
import { prepareApplicationForm } from "./prepare-flow";

export class LeverAutomator implements PlatformAutomator {
  platform = "LEVER";

  canHandle(url: string) {
    return url.includes("lever.co") || url.includes("jobs.lever.co");
  }

  async discoverJobs(company: string, query: string): Promise<DiscoveredJob[]> {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${company}?mode=json`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];

    const postings = await res.json();
    const q = query.toLowerCase();
    return (postings as Array<{
      id: string;
      text: string;
      hostedUrl: string;
      categories: { location?: string; team?: string };
      descriptionPlain?: string;
      createdAt?: number;
    }>)
      .filter((p) => p.text.toLowerCase().includes(q))
      .map((p) => ({
        externalId: p.id,
        source: "LEVER" as const,
        sourceUrl: p.hostedUrl,
        title: p.text,
        company,
        location: p.categories?.location,
        description: p.descriptionPlain || "",
        postedAt: p.createdAt ? new Date(p.createdAt) : undefined,
        metadata: { company },
      }));
  }

  async prepareApplication(
    browser: BrowserAutomationClient,
    jobUrl: string,
    profile: ApplicationProfile,
    documents: ApplicationDocuments,
    options?: { autoSubmit?: boolean }
  ): Promise<SubmissionResult> {
    return prepareApplicationForm({
      browser,
      jobUrl,
      platform: this.platform,
      profile,
      documents,
      autoSubmit: options?.autoSubmit,
    });
  }
}
