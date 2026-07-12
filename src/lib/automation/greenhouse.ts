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
    await browser.navigate(jobUrl);
    await browser.waitForSelector("Apply", 20000);

    const snap = await browser.snapshot();
    const applyBtn = findElement(snap, [/apply/i, /submit application/i]);
    if (applyBtn) await browser.click(applyBtn.ref);

    await fillCommonFields(browser, profile);

    if (documents.resumeText) {
      const resumeField = findElement(await browser.snapshot(), [
        /resume/i,
        /cv/i,
        /paste/i,
      ]);
      if (resumeField) {
        await browser.type(resumeField.ref, documents.resumeText.slice(0, 8000));
      }
    }

    if (documents.coverLetterText) {
      const clField = findElement(await browser.snapshot(), [/cover letter/i]);
      if (clField) {
        await browser.type(clField.ref, documents.coverLetterText.slice(0, 5000));
      }
    }

    const formData = { platform: "GREENHOUSE", jobUrl, profile: profile.email };

    if (!options?.autoSubmit) {
      return {
        success: true,
        status: "pending_review",
        message: "Greenhouse application filled — ready for review",
        formData,
      };
    }

    const submitBtn = findElement(await browser.snapshot(), [/submit/i]);
    if (submitBtn) {
      await browser.click(submitBtn.ref);
      return {
        success: true,
        status: "submitted",
        message: "Greenhouse application submitted",
        formData,
      };
    }

    return {
      success: false,
      status: "requires_manual",
      message: "Could not find submit button on Greenhouse form",
      formData,
    };
  }
}
