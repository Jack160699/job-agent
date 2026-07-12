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
    await browser.navigate(jobUrl);
    await browser.waitForSelector("Apply", 20000);

    const snap = await browser.snapshot();
    const applyBtn = findElement(snap, [/apply for this job/i, /apply/i]);
    if (applyBtn) await browser.click(applyBtn.ref);

    await fillCommonFields(browser, profile);

    if (documents.coverLetterText) {
      const clField = findElement(await browser.snapshot(), [
        /additional information/i,
        /cover letter/i,
        /why/i,
      ]);
      if (clField) {
        await browser.type(clField.ref, documents.coverLetterText.slice(0, 5000));
      }
    }

    const formData = { platform: "LEVER", jobUrl, profile: profile.email };

    if (!options?.autoSubmit) {
      return {
        success: true,
        status: "pending_review",
        message: "Lever application filled — ready for review",
        formData,
      };
    }

    const submitBtn = findElement(await browser.snapshot(), [/submit application/i]);
    if (submitBtn) {
      await browser.click(submitBtn.ref);
      return {
        success: true,
        status: "submitted",
        message: "Lever application submitted",
        formData,
      };
    }

    return {
      success: false,
      status: "requires_manual",
      message: "Could not find submit button on Lever form",
      formData,
    };
  }
}
