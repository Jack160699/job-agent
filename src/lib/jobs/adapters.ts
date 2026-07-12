import type { DiscoveredJob, JobSearchFilters } from "./types";
import { getAllAutomators } from "@/lib/automation/registry";

function boardsFor(
  filters: JobSearchFilters,
  platform: "greenhouse" | "lever" | "ashby" | "workday",
  envKey: string
): string[] {
  const fromDiscovery = filters.discoveryBoards?.[platform] || [];
  const fromEnv = (process.env[envKey] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...fromDiscovery, ...fromEnv])];
}

export class GreenhouseAdapter {
  source = "GREENHOUSE" as const;
  name = "Greenhouse";

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const boards = boardsFor(filters, "greenhouse", "JOB_SEARCH_GREENHOUSE_BOARDS");
    if (boards.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "GREENHOUSE")!;
    const jobs: DiscoveredJob[] = [];

    for (const board of boards.slice(0, 4)) {
      for (const title of filters.titles.slice(0, 3)) {
        try {
          jobs.push(...(await automator.discoverJobs(board, title)));
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

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const companies = boardsFor(filters, "lever", "JOB_SEARCH_LEVER_COMPANIES");
    if (companies.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "LEVER")!;
    const jobs: DiscoveredJob[] = [];

    for (const company of companies.slice(0, 4)) {
      for (const title of filters.titles.slice(0, 3)) {
        try {
          jobs.push(...(await automator.discoverJobs(company, title)));
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

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const boards = boardsFor(filters, "ashby", "JOB_SEARCH_ASHBY_BOARDS");
    if (boards.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "ASHBY")!;
    const jobs: DiscoveredJob[] = [];

    for (const board of boards.slice(0, 4)) {
      for (const title of filters.titles.slice(0, 3)) {
        try {
          jobs.push(...(await automator.discoverJobs(board, title)));
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

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const companies = boardsFor(filters, "workday", "JOB_SEARCH_WORKDAY_COMPANIES");
    if (companies.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "WORKDAY")!;
    const jobs: DiscoveredJob[] = [];

    for (const company of companies) {
      for (const title of filters.titles.slice(0, 3)) {
        try {
          jobs.push(...(await automator.discoverJobs(company, title)));
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
