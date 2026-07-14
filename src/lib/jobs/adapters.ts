import type { DiscoveredJob, JobSearchFilters } from "./types";
import { getAllAutomators } from "@/lib/automation/registry";

const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Job source returned ${response.status}`);
  }
  return response.json();
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

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
    const match = url.match(/jobs\.lever\.co\/([^/?#]+)\/([^/?#]+)/i);
    if (!match) return null;
    try {
      const job = (await fetchJson(
        `https://api.lever.co/v0/postings/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`
      )) as {
        id?: string;
        text?: string;
        hostedUrl?: string;
        descriptionPlain?: string;
        additionalPlain?: string;
        createdAt?: number;
        categories?: {
          location?: string;
          commitment?: string;
          team?: string;
        };
      };
      if (!job.text) return null;
      return {
        externalId: job.id ?? match[2],
        source: "LEVER",
        sourceUrl: job.hostedUrl ?? url,
        title: job.text,
        company: match[1],
        location: job.categories?.location,
        description: [job.descriptionPlain, job.additionalPlain]
          .filter(Boolean)
          .join("\n\n"),
        postedAt: parseDate(job.createdAt),
        metadata: {
          team: job.categories?.team,
          commitment: job.categories?.commitment,
          extractionMethod: "lever_postings_api",
        },
      };
    } catch {
      return null;
    }
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
    const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([^/?#]+)/i);
    if (!match) return null;
    try {
      const board = (await fetchJson(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(match[1])}`
      )) as {
        jobs?: Array<{
          id?: string;
          title?: string;
          location?: string;
          descriptionPlain?: string;
          descriptionHtml?: string;
          jobUrl?: string;
          applyUrl?: string;
          publishedAt?: string;
          employmentType?: string;
          department?: string;
          team?: string;
        }>;
      };
      const job = board.jobs?.find(
        (candidate) =>
          candidate.id === match[2] ||
          candidate.jobUrl?.includes(`/${match[2]}`) ||
          candidate.applyUrl?.includes(`/${match[2]}`)
      );
      if (!job?.title) return null;
      return {
        externalId: job.id ?? match[2],
        source: "ASHBY",
        sourceUrl: job.jobUrl ?? url,
        title: job.title,
        company: match[1],
        location: job.location,
        description:
          job.descriptionPlain ??
          (job.descriptionHtml ? stripHtml(job.descriptionHtml) : ""),
        postedAt: parseDate(job.publishedAt),
        metadata: {
          employmentType: job.employmentType,
          department: job.department,
          team: job.team,
          extractionMethod: "ashby_job_board_api",
        },
      };
    } catch {
      return null;
    }
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
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith("myworkdayjobs.com")) return null;
      const tenant = parsed.hostname.split(".")[0];
      const parts = parsed.pathname.split("/").filter(Boolean);
      const localeIndex = parts.findIndex((part) =>
        /^[a-z]{2}-[A-Z]{2}$/.test(part)
      );
      const siteIndex = localeIndex >= 0 ? localeIndex + 1 : 0;
      const jobIndex = parts.indexOf("job");
      const site = parts[siteIndex];
      if (!tenant || !site || jobIndex < 0) return null;
      const jobPath = parts.slice(jobIndex).join("/");
      const data = (await fetchJson(
        `${parsed.origin}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}/${jobPath}`
      )) as {
        jobPostingInfo?: {
          id?: string;
          title?: string;
          jobDescription?: string;
          location?: string;
          postedOn?: string;
          externalUrl?: string;
          jobReqId?: string;
        };
      };
      const job = data.jobPostingInfo;
      if (!job?.title) return null;
      return {
        externalId: job.jobReqId ?? job.id ?? parts.at(-1),
        source: "WORKDAY",
        sourceUrl: job.externalUrl
          ? new URL(job.externalUrl, parsed.origin).toString()
          : url,
        title: job.title,
        company: tenant,
        location: job.location,
        description: stripHtml(job.jobDescription ?? ""),
        postedAt: parseDate(job.postedOn),
        metadata: { extractionMethod: "workday_cxs_api" },
      };
    } catch {
      return null;
    }
  }

  canAutoApply = true;
}
