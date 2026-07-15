import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "@/lib/browser/types";
import type { PlatformAutomator } from "./base";
import { prepareApplicationForm } from "./prepare-flow";

export class GenericAtsAutomator implements PlatformAutomator {
  platform = "GENERIC_ATS";
  canAutoApply = false;

  canHandle(value: string) {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        /\/(jobs?|careers?|apply)(\/|$)/i.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  async discoverJobs(): Promise<DiscoveredJob[]> {
    return [];
  }

  async prepareApplication(
    browser: BrowserAutomationClient,
    jobUrl: string,
    profile: ApplicationProfile,
    documents: ApplicationDocuments
  ): Promise<SubmissionResult> {
    // Generic forms are fill-for-review only. Their final controls have not
    // been provider-verified, so explicit authorization never auto-clicks.
    return prepareApplicationForm({
      browser,
      jobUrl,
      platform: this.platform,
      profile,
      documents,
      autoSubmit: false,
    });
  }
}
