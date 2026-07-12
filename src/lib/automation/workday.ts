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

export class WorkdayAutomator implements PlatformAutomator {
  platform = "WORKDAY";

  canHandle(url: string) {
    return url.includes("myworkdayjobs.com") || url.includes("workday.com");
  }

  async discoverJobs(companySlug: string, query: string): Promise<DiscoveredJob[]> {
    const browser = await import("@/lib/browser/client").then((m) =>
      m.createBrowserClient()
    );
    try {
      const searchUrl = `https://${companySlug}.wd1.myworkdayjobs.com/en-US/search?q=${encodeURIComponent(query)}`;
      await browser.navigate(searchUrl);
      await browser.waitForSelector("job", 15000);
      const snap = await browser.snapshot();

      return snap.elements
        .filter((el) => /link/i.test(el.role) && el.name.length > 5)
        .slice(0, 20)
        .map((el, i) => ({
          externalId: `workday-${companySlug}-${i}`,
          source: "WORKDAY" as const,
          sourceUrl: snap.url,
          title: el.name,
          company: companySlug,
          description: `Workday listing discovered via browser search for: ${query}`,
          metadata: { companySlug, requiresBrowser: true, elementRef: el.ref },
        }));
    } catch {
      return [];
    } finally {
      await browser.close();
    }
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
    const applyBtn = findElement(snap, [/apply/i, /apply manually/i]);
    if (applyBtn) await browser.click(applyBtn.ref);

    await fillCommonFields(browser, profile);

    if (documents.resumeText) {
      const field = findElement(await browser.snapshot(), [
        /resume/i,
        /cv/i,
        /work experience/i,
      ]);
      if (field) await browser.type(field.ref, documents.resumeText.slice(0, 8000));
    }

    const formData = { platform: "WORKDAY", jobUrl, profile: profile.email };

    if (!options?.autoSubmit) {
      return {
        success: true,
        status: "pending_review",
        message: "Workday application filled — ready for review",
        formData,
      };
    }

    const submitBtn = findElement(await browser.snapshot(), [/submit/i, /finish/i]);
    if (submitBtn) {
      await browser.click(submitBtn.ref);
      return {
        success: true,
        status: "submitted",
        message: "Workday application submitted",
        formData,
      };
    }

    return {
      success: false,
      status: "requires_manual",
      message: "Workday multi-step form requires manual completion",
      formData,
    };
  }
}
