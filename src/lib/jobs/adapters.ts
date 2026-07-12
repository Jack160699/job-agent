import type { DiscoveredJob, JobSearchFilters } from "./types";

export class GreenhouseAdapter {
  source = "GREENHOUSE" as const;
  name = "Greenhouse";

  async search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    const jobs: DiscoveredJob[] = [];
    for (const title of filters.titles.slice(0, 3)) {
      try {
        const boardJobs = await this.searchBoard(title, filters.locations[0]);
        jobs.push(...boardJobs);
      } catch {
        // Board may not exist
      }
    }
    return jobs;
  }

  private async searchBoard(
    title: string,
    location?: string
  ): Promise<DiscoveredJob[]> {
    const query = encodeURIComponent(title);
    const loc = location ? `&location=${encodeURIComponent(location)}` : "";
    const url = `https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true&query=${query}${loc}`;

    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map(
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
          company: "Unknown",
          location: job.location?.name,
          description: job.content || "",
          postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
        })
      );
    } catch {
      return [];
    }
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
    const jobs: DiscoveredJob[] = [];
    for (const title of filters.titles.slice(0, 3)) {
      const results = await this.searchCompany(title);
      jobs.push(...results);
    }
    return jobs;
  }

  private async searchCompany(query: string): Promise<DiscoveredJob[]> {
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/example?mode=json`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return [];
      const postings = await res.json();
      return (postings as Array<{
        id: string;
        text: string;
        hostedUrl: string;
        categories: { location?: string; team?: string };
        descriptionPlain?: string;
        createdAt?: number;
      }>)
        .filter((p) => p.text.toLowerCase().includes(query.toLowerCase()))
        .map((p) => ({
          externalId: p.id,
          source: "LEVER" as const,
          sourceUrl: p.hostedUrl,
          title: p.text,
          company: "Unknown",
          location: p.categories?.location,
          description: p.descriptionPlain || "",
          postedAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }));
    } catch {
      return [];
    }
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    return {
      source: "LEVER",
      sourceUrl: url,
      title: "Job from Lever",
      company: "Unknown",
      description: "",
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
      title: `${title} (Browser Search Queued)`,
      company: "Various",
      description: `Automated browser search queued for: ${title}. Configure browser MCP for live scraping.`,
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
