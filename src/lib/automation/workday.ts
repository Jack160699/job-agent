import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { PlatformAutomator } from "./base";
import { prepareApplicationForm } from "./prepare-flow";

export class WorkdayAutomator implements PlatformAutomator {
  platform = "WORKDAY";

  canHandle(url: string) {
    return url.includes("myworkdayjobs.com") || url.includes("workday.com");
  }

  async discoverJobs(companySlug: string, query: string): Promise<DiscoveredJob[]> {
    try {
      let tenant = companySlug;
      let origin = `https://${companySlug}.wd1.myworkdayjobs.com`;
      let site = "External";
      if (/^https?:\/\//i.test(companySlug)) {
        const configured = new URL(companySlug);
        origin = configured.origin;
        tenant = configured.hostname.split(".")[0];
        const parts = configured.pathname.split("/").filter(Boolean);
        const localeIndex = parts.findIndex((part) =>
          /^[a-z]{2}-[A-Z]{2}$/.test(part)
        );
        site = parts[localeIndex >= 0 ? localeIndex + 1 : 0] || site;
      }

      const response = await fetch(
        `${origin}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/jobs`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appliedFacets: {},
            limit: 20,
            offset: 0,
            searchText: query,
          }),
          signal: AbortSignal.timeout(12_000),
        }
      );
      if (!response.ok) return [];
      const data = (await response.json()) as {
        jobPostings?: Array<{
          title?: string;
          externalPath?: string;
          locationsText?: string;
          postedOn?: string;
          bulletFields?: string[];
        }>;
      };

      return (data.jobPostings ?? [])
        .filter((job) => Boolean(job.title && job.externalPath))
        .map((job) => ({
          externalId: job.externalPath?.split("_").at(-1),
          source: "WORKDAY" as const,
          sourceUrl: new URL(job.externalPath!, origin).toString(),
          title: job.title!,
          company: tenant,
          location: job.locationsText,
          description: (job.bulletFields ?? []).join("\n"),
          postedAt: job.postedOn ? new Date(job.postedOn) : undefined,
          metadata: {
            companySlug: tenant,
            workdaySite: site,
            extractionMethod: "workday_cxs_search_api",
          },
        }));
    } catch {
      return [];
    }
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
