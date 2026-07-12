import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import {
  fillCommonFields,
  findElement,
  type PlatformAutomator,
} from "./base";

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
    await browser.navigate(jobUrl);
    await browser.waitForSelector("Apply", 25000);

    const snap = await browser.snapshot();
    const applyBtn = findElement(snap, [/apply/i, /start application/i]);
    if (applyBtn) await browser.click(applyBtn.ref);

    await fillCommonFields(browser, profile);

    if (documents.resumeText) {
      const field = findElement(await browser.snapshot(), [/resume/i, /experience/i]);
      if (field) await browser.type(field.ref, documents.resumeText.slice(0, 8000));
    }

    if (documents.coverLetterText) {
      const field = findElement(await browser.snapshot(), [/cover letter/i, /motivation/i]);
      if (field) await browser.type(field.ref, documents.coverLetterText.slice(0, 5000));
    }

    const formData = { platform: "ASHBY", jobUrl, profile: profile.email };

    if (!options?.autoSubmit) {
      return {
        success: true,
        status: "pending_review",
        message: "Ashby application filled — ready for review",
        formData,
      };
    }

    const submitBtn = findElement(await browser.snapshot(), [/submit/i, /finish/i]);
    if (submitBtn) {
      await browser.click(submitBtn.ref);
      return {
        success: true,
        status: "submitted",
        message: "Ashby application submitted",
        formData,
      };
    }

    return {
      success: false,
      status: "requires_manual",
      message: "Could not find submit button on Ashby form",
      formData,
    };
  }
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
