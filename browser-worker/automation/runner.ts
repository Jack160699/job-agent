import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type {
  ApplicationDocuments,
  ApplicationProfile,
  BrowserAutomationClient,
  SubmissionResult,
} from "../../src/lib/browser/types";
import { getAutomatorForUrl } from "../../src/lib/automation/registry";
import { prepareApplicationForm } from "../../src/lib/automation/prepare-flow";

export async function runPrepareApplicationTask(input: {
  browser: BrowserAutomationClient;
  jobUrl: string;
  profile: ApplicationProfile;
  documents: ApplicationDocuments;
  autoSubmit?: boolean;
  screenshotDir?: string;
  onProgress?: (progress: number) => Promise<void>;
  shouldContinue?: () => Promise<boolean>;
}): Promise<SubmissionResult & { screenshotPaths: string[] }> {
  const screenshotPaths: string[] = [];
  const dir =
    input.screenshotDir || join(tmpdir(), "job-agent-browser-screenshots");
  await mkdir(dir, { recursive: true });

  const capture = async (label: string) => {
    const buf = await input.browser.screenshot();
    const path = join(dir, `${Date.now()}-${label}.png`);
    await writeFile(path, buf);
    screenshotPaths.push(path);
    return path;
  };

  const automator = getAutomatorForUrl(input.jobUrl);
  if (!automator) {
    return {
      success: false,
      status: "requires_manual",
      message: "No automator for this platform",
      screenshotPaths,
    };
  }

  await input.onProgress?.(10);
  await capture("start");
  await input.onProgress?.(40);

  const result = await prepareApplicationForm({
    browser: input.browser,
    jobUrl: input.jobUrl,
    platform: automator.platform,
    profile: input.profile,
    documents: input.documents,
    autoSubmit: input.autoSubmit,
    shouldContinue: input.shouldContinue,
  });

  await capture("final");
  await input.onProgress?.(100);
  return { ...result, screenshotPaths };
}
