import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { PlatformAutomator } from "./base";
import { prepareApplicationForm } from "./prepare-flow";

export class GreenhouseAutomator implements PlatformAutomator {
  platform = "GREENHOUSE";

  canHandle(url: string) {
    return url.includes("greenhouse.io");
  }

  async discoverJobs(boardSlug: string, query: string): Promise<DiscoveredJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs?content=true`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];

    const data = await res.json();
    const q = query.toLowerCase();
    return (data.jobs || [])
      .filter((job: { title: string }) => job.title.toLowerCase().includes(q))
      .map(
        (job: {
          id: number;
          title: string;
          absolute_url: string;
          location?: { name: string };
          content?: string;
          updated_at?: string;
        }) => ({
          externalId: String(job.id),
          source: "GREENHOUSE" as const,
          sourceUrl: job.absolute_url,
          title: job.title,
          company: boardSlug,
          location: job.location?.name,
          description: job.content || "",
          postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
          metadata: { boardSlug },
        })
      );
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
