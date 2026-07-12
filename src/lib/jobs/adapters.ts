import type { DiscoveredJob, JobSearchFilters } from "./types";
import { getAllAutomators } from "@/lib/automation/registry";

function getBoardSlugs(
  filters: JobSearchFilters & { targetCompanies?: string[] },
  envKey: string,
  fallback: string[]
) {
  const fromSettings = filters.targetCompanies || [];
  const fromEnv = (process.env[envKey] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromSettings, ...fromEnv, ...fallback])];
}

export class GreenhouseAdapter {
  source = "GREENHOUSE" as const;
  name = "Greenhouse";

  async search(
    filters: JobSearchFilters & { targetCompanies?: string[] }
  ): Promise<DiscoveredJob[]> {
    const boards = getBoardSlugs(filters, "JOB_SEARCH_GREENHOUSE_BOARDS", [
      "openai",
      "stripe",
    ]);
    const automator = getAllAutomators().find((a) => a.platform === "GREENHOUSE")!;
    const jobs: DiscoveredJob[] = [];

    for (const board of boards.slice(0, 2)) {
      for (const title of filters.titles.slice(0, 2)) {
        try {
          const results = await automator.discoverJobs(board, title);
          jobs.push(...results);
        } catch {
          // Board may not exist
        }
      }
    }
    return jobs;
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    const match = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
    if (!match) return null;
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${match[1]}/jobs/${match[2]}?content=true`
      );
      if (!res.ok) return null;
      const job = await res.json();
      return {
        externalId: String(job.id),
        source: "GREENHOUSE",
        sourceUrl: job.absolute_url,
        title: job.title,
        company: match[1],
        location: job.location?.name,
        description: job.content || "",
      };
    } catch {
      return null;
    }
  }

  canAutoApply = true;
}

export class LeverAdapter {
  source = "LEVER" as const;
  name = "Lever";

  async search(
    filters: JobSearchFilters & { targetCompanies?: string[] }
  ): Promise<DiscoveredJob[]> {
    const companies = getBoardSlugs(filters, "JOB_SEARCH_LEVER_COMPANIES", [
      "netflix",
      "palantir",
    ]);
    const automator = getAllAutomators().find((a) => a.platform === "LEVER")!;
    const jobs: DiscoveredJob[] = [];

    for (const company of companies.slice(0, 2)) {
      for (const title of filters.titles.slice(0, 2)) {
        try {
          const results = await automator.discoverJobs(company, title);
          jobs.push(...results);
        } catch {
          // Company may not exist
        }
      }
    }
    return jobs;
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    const match = url.match(/jobs\.lever\.co\/([^/]+)/);
    if (!match) return null;
    return {
      source: "LEVER",
      sourceUrl: url,
      title: "Job from Lever",
      company: match[1],
      description: "",
    };
  }

  canAutoApply = true;
}

export class AshbyAdapter {
  source = "ASHBY" as const;
  name = "Ashby";

  async search(
    filters: JobSearchFilters & { targetCompanies?: string[] }
  ): Promise<DiscoveredJob[]> {
    const boards = getBoardSlugs(filters, "JOB_SEARCH_ASHBY_BOARDS", [
      "linear",
      "notion",
    ]);
    const automator = getAllAutomators().find((a) => a.platform === "ASHBY")!;
    const jobs: DiscoveredJob[] = [];

    for (const board of boards.slice(0, 2)) {
      for (const title of filters.titles.slice(0, 2)) {
        try {
          const results = await automator.discoverJobs(board, title);
          jobs.push(...results);
        } catch {
          // Board may not exist
        }
      }
    }
    return jobs;
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    return {
      source: "ASHBY",
      sourceUrl: url,
      title: "Job from Ashby",
      company: "Unknown",
      description: "",
      metadata: { requiresBrowser: true },
    };
  }

  canAutoApply = true;
}

export class WorkdayAdapter {
  source = "WORKDAY" as const;
  name = "Workday";

  async search(
    filters: JobSearchFilters & { targetCompanies?: string[] }
  ): Promise<DiscoveredJob[]> {
    const companies = getBoardSlugs(filters, "JOB_SEARCH_WORKDAY_COMPANIES", []);
    const automator = getAllAutomators().find((a) => a.platform === "WORKDAY")!;
    const jobs: DiscoveredJob[] = [];

    for (const company of companies) {
      for (const title of filters.titles.slice(0, 2)) {
        try {
          const results = await automator.discoverJobs(company, title);
          jobs.push(...results);
        } catch {
          // Browser search may fail without Playwright
        }
      }
    }
    return jobs;
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    return {
      source: "WORKDAY",
      sourceUrl: url,
      title: "Job from Workday",
      company: "Unknown",
      description: "Use browser automation to fetch full details.",
      metadata: { requiresBrowser: true },
    };
  }

  canAutoApply = true;
}

export class BrowserJobAdapter {
  source = "OTHER" as const;
  name = "Browser Automation";

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    return filters.titles.map((title) => ({
      source: "OTHER" as const,
      sourceUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}`,
      title: `${title} (Browser Search)`,
      company: "Various",
      description: `Browser MCP search for: ${title}`,
      metadata: { searchQuery: title, requiresBrowser: true },
    }));
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    return {
      source: "OTHER",
      sourceUrl: url,
      title: "Job from URL",
      company: "Unknown",
      description: "Use browser automation to fetch full details.",
      metadata: { requiresBrowser: true },
    };
  }

  canAutoApply = false;
}
