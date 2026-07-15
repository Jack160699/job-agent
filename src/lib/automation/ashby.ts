import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { PlatformAutomator } from "./base";
import { prepareApplicationForm } from "./prepare-flow";

export class AshbyAutomator implements PlatformAutomator {
  platform = "ASHBY";

  canHandle(url: string) {
    return url.includes("ashbyhq.com");
  }

  async discoverJobs(boardSlug: string, query: string): Promise<DiscoveredJob[]> {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${boardSlug}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const q = query.toLowerCase();
    return (data.jobs || [])
      .filter((job: { title: string; isListed?: boolean }) =>
        job.isListed !== false && job.title.toLowerCase().includes(q)
      )
      .map(
        (job: {
          id: string;
          title: string;
          jobUrl: string;
          location?: string;
          descriptionHtml?: string;
          publishedAt?: string;
          department?: string;
        }) => ({
          externalId: job.id,
          source: "ASHBY" as const,
          sourceUrl: job.jobUrl,
          title: job.title,
          company: boardSlug,
          location: job.location,
          description: stripHtml(job.descriptionHtml || ""),
          postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
          metadata: { boardSlug, department: job.department },
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

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
