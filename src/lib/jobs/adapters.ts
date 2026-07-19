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
  platform: "greenhouse" | "lever" | "ashby" | "workday"
): string[] {
  const fromDiscovery = filters.discoveryBoards?.[platform] || [];
  return [...new Set(fromDiscovery)];
}

/** Prefer explainable search-plan queries; fall back to flat titles. */
function discoveryQueries(filters: JobSearchFilters): Array<{
  title: string;
  location: string | null;
  remoteScope: "INDIA" | "WORLDWIDE" | null;
  stage: "strict" | "balanced" | "recovery";
}> {
  if (filters.queries && filters.queries.length > 0) {
    return filters.queries.slice(0, 12).map((query) => ({
      title: query.title,
      location: query.location,
      remoteScope: query.remoteScope,
      stage: query.stage ?? "strict",
    }));
  }
  return filters.titles.slice(0, 3).map((title) => ({
    title,
    location: filters.locations[0] ?? null,
    remoteScope: filters.remote ? ("WORLDWIDE" as const) : null,
    stage: "strict" as const,
  }));
}

function withSearchProvenance(
  jobs: DiscoveredJob[],
  query: ReturnType<typeof discoveryQueries>[number]
): DiscoveredJob[] {
  return jobs.map((job) => ({
    ...job,
    metadata: {
      ...(job.metadata ?? {}),
      searchStage: query.stage,
      searchQuery: query.title,
      requestedLocation: query.location,
      remoteScope: query.remoteScope,
    },
  }));
}

function queryForJobTitle(
  title: string,
  queries: ReturnType<typeof discoveryQueries>
) {
  const normalizedTitle = title.toLowerCase();
  const scored = queries.map((query) => {
    const normalizedQuery = query.title.toLowerCase();
    const queryTokens = normalizedQuery
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length > 2);
    const tokenMatches = queryTokens.filter((token) =>
      normalizedTitle.includes(token)
    ).length;
    const exact =
      normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle);
    return {
      query,
      score: exact
        ? 100 + normalizedQuery.length
        : queryTokens.length > 0
          ? tokenMatches / queryTokens.length
          : 0,
    };
  });
  const best = scored.sort((left, right) => right.score - left.score)[0];
  if (best && best.score > 0) return best.query;
  return (
    [...queries].reverse().find((query) => query.stage === "recovery") ??
    queries[queries.length - 1]
  );
}

function assignSearchProvenance(
  jobs: DiscoveredJob[],
  queries: ReturnType<typeof discoveryQueries>
) {
  return jobs.flatMap((job) => {
    const query = queryForJobTitle(job.title, queries);
    return query ? withSearchProvenance([job], query) : [];
  });
}

export class GreenhouseAdapter {
  source = "GREENHOUSE" as const;
  name = "Greenhouse";

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const boards = boardsFor(filters, "greenhouse");
    if (boards.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "GREENHOUSE")!;
    const jobs: DiscoveredJob[] = [];
    const queries = discoveryQueries(filters);

    for (const board of boards.slice(0, 4)) {
      try {
        jobs.push(
          ...assignSearchProvenance(
            await automator.discoverJobs(board, ""),
            queries
          )
        );
      } catch {
        // Board may not exist
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
    const companies = boardsFor(filters, "lever");
    if (companies.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "LEVER")!;
    const jobs: DiscoveredJob[] = [];
    const queries = discoveryQueries(filters);

    for (const company of companies.slice(0, 4)) {
      try {
        jobs.push(
          ...assignSearchProvenance(
            await automator.discoverJobs(company, ""),
            queries
          )
        );
      } catch {
        // Company may not exist
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
    const boards = boardsFor(filters, "ashby");
    if (boards.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "ASHBY")!;
    const jobs: DiscoveredJob[] = [];
    const queries = discoveryQueries(filters);

    for (const board of boards.slice(0, 4)) {
      try {
        jobs.push(
          ...assignSearchProvenance(
            await automator.discoverJobs(board, ""),
            queries
          )
        );
      } catch {
        // Board may not exist
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
    const companies = boardsFor(filters, "workday");
    if (companies.length === 0) return [];

    const automator = getAllAutomators().find((a) => a.platform === "WORKDAY")!;
    const jobs: DiscoveredJob[] = [];
    const stageQueries = discoveryQueries(filters).filter(
      (query, index, all) =>
        all.findIndex((candidate) => candidate.stage === query.stage) === index
    );

    for (const company of companies) {
      for (const query of stageQueries) {
        try {
          jobs.push(
            ...withSearchProvenance(
              await automator.discoverJobs(company, query.title),
              query
            )
          );
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
