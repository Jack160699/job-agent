import { createHash } from "node:crypto";
import type {
  DiscoveredJob,
  JobSearchFilters,
  JobSourceAdapter,
} from "./types";

type PublicDiscoverySource = "LINKEDIN" | "NAUKRI";
type ProviderName = "brave" | "bing" | "google_cse" | "serpapi";
type PublicDiscoveryEnv = Record<string, string | undefined>;

interface SearchProviderConfig {
  name: ProviderName;
  endpoint: string;
  headers: Record<string, string>;
  queryParam: string;
  extraParams: Record<string, string>;
}

interface IndexedResult {
  title: string;
  url: string;
  snippet: string;
  discoveredAt: Date;
}

export type PublicDiscoveryErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "PROVIDER_ERROR";

export class PublicDiscoveryError extends Error {
  constructor(
    public readonly code: PublicDiscoveryErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PublicDiscoveryError";
  }
}

export function configuredPublicSearchProvider(
  env: PublicDiscoveryEnv = process.env
): ProviderName | null {
  if (env.BRAVE_SEARCH_API_KEY) return "brave";
  if (env.BING_SEARCH_API_KEY) return "bing";
  if (env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID) return "google_cse";
  if (env.SERPAPI_API_KEY) return "serpapi";
  return null;
}

function providerConfig(env: PublicDiscoveryEnv): SearchProviderConfig {
  const name = configuredPublicSearchProvider(env);
  if (!name) {
    throw new PublicDiscoveryError(
      "NOT_CONFIGURED",
      "Public discovery is unavailable because no approved search provider is configured."
    );
  }
  if (name === "brave") {
    return {
      name,
      endpoint: "https://api.search.brave.com/res/v1/web/search",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY!,
      },
      queryParam: "q",
      extraParams: { count: "20", freshness: "pm" },
    };
  }
  if (name === "bing") {
    return {
      name,
      endpoint: "https://api.bing.microsoft.com/v7.0/search",
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": env.BING_SEARCH_API_KEY!,
      },
      queryParam: "q",
      extraParams: { count: "20", freshness: "Month", responseFilter: "Webpages" },
    };
  }
  if (name === "google_cse") {
    return {
      name,
      endpoint: "https://customsearch.googleapis.com/customsearch/v1",
      headers: { Accept: "application/json" },
      queryParam: "q",
      extraParams: {
        key: env.GOOGLE_CSE_API_KEY!,
        cx: env.GOOGLE_CSE_ID!,
        num: "10",
        dateRestrict: "m1",
      },
    };
  }
  return {
    name,
    endpoint: "https://serpapi.com/search.json",
    headers: { Accept: "application/json" },
    queryParam: "q",
    extraParams: {
      api_key: env.SERPAPI_API_KEY!,
      engine: "google",
      num: "20",
      tbs: "qdr:m",
    },
  };
}

function parseProviderResults(
  provider: ProviderName,
  payload: unknown
): IndexedResult[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  const now = new Date();
  if (provider === "brave") {
    const web = root.web as { results?: Array<Record<string, unknown>> } | undefined;
    return (web?.results ?? []).map((item) => ({
      title: String(item.title ?? ""),
      url: String(item.url ?? ""),
      snippet: String(item.description ?? ""),
      discoveredAt: now,
    }));
  }
  if (provider === "bing") {
    const pages = root.webPages as { value?: Array<Record<string, unknown>> } | undefined;
    return (pages?.value ?? []).map((item) => ({
      title: String(item.name ?? ""),
      url: String(item.url ?? ""),
      snippet: String(item.snippet ?? ""),
      discoveredAt: now,
    }));
  }
  if (provider === "google_cse") {
    return ((root.items as Array<Record<string, unknown>> | undefined) ?? []).map(
      (item) => ({
        title: String(item.title ?? ""),
        url: String(item.link ?? ""),
        snippet: String(item.snippet ?? ""),
        discoveredAt: now,
      })
    );
  }
  return (
    (root.organic_results as Array<Record<string, unknown>> | undefined) ?? []
  ).map((item) => ({
    title: String(item.title ?? ""),
    url: String(item.link ?? ""),
    snippet: String(item.snippet ?? ""),
    discoveredAt: now,
  }));
}

function canonicalIndexedJobUrl(
  source: PublicDiscoverySource,
  value: string
): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const validHost =
    source === "LINKEDIN"
      ? host === "linkedin.com" || host.endsWith(".linkedin.com")
      : host === "naukri.com" || host.endsWith(".naukri.com");
  if (!validHost) return null;

  const validPath =
    source === "LINKEDIN"
      ? /^\/jobs\/view\/[^/]+/i.test(url.pathname)
      : /\/(?:job-listings|job-listing)[-/][^/]+/i.test(url.pathname);
  if (!validPath) return null;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["trk", "trackingid", "refid", "ref", "src"].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function isKnownExpired(text: string): boolean {
  return /no longer accepting applications|job has expired|position has been filled|applications? closed/i.test(
    text
  );
}

function splitIndexedTitle(
  source: PublicDiscoverySource,
  value: string
): { title: string; company: string } {
  const cleaned = value
    .replace(/\s*[|–-]\s*(LinkedIn|Naukri(?:\.com)?)\s*$/i, "")
    .trim();
  if (source === "LINKEDIN") {
    const parts = cleaned.split(/\s+[–-]\s+/);
    return {
      title: parts[0]?.trim() || "LinkedIn job",
      company: parts[1]?.trim() || "Company shown on LinkedIn",
    };
  }
  const match = cleaned.match(/^(.+?)\s+job\s+(?:in|at)\s+(.+?)(?:\s+at\s+.+)?$/i);
  return {
    title: match?.[1]?.trim() || cleaned || "Naukri job",
    company: match?.[2]?.trim() || "Company shown on Naukri",
  };
}

function publicDiscoveryQueries(
  source: PublicDiscoverySource,
  filters: JobSearchFilters
): string[] {
  const domain =
    source === "LINKEDIN" ? "linkedin.com/jobs/view" : "naukri.com/job-listings";
  const queries =
    filters.queries?.slice(0, 3).map((query) => ({
      title: query.title,
      location: query.location,
    })) ??
    filters.titles.slice(0, 3).map((title) => ({
      title,
      location: filters.locations[0] ?? null,
    }));
  return queries.map(
    ({ title, location }) =>
      `site:${domain} "${title}" ${location ? `"${location}"` : ""} India jobs`
  );
}

async function searchIndex(
  query: string,
  fetcher: typeof fetch,
  env: PublicDiscoveryEnv
): Promise<{ provider: ProviderName; results: IndexedResult[] }> {
  const provider = providerConfig(env);
  const url = new URL(provider.endpoint);
  url.searchParams.set(provider.queryParam, query);
  for (const [key, value] of Object.entries(provider.extraParams)) {
    url.searchParams.set(key, value);
  }
  const response = await fetcher(url, {
    headers: provider.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 429) {
    const quota = response.headers.get("x-ratelimit-remaining");
    throw new PublicDiscoveryError(
      quota === "0" ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
      quota === "0"
        ? "Public-discovery search quota is exhausted."
        : "Public-discovery search provider is rate limited."
    );
  }
  if (!response.ok) {
    throw new PublicDiscoveryError(
      "PROVIDER_ERROR",
      `Public-discovery provider returned HTTP ${response.status}.`
    );
  }
  return {
    provider: provider.name,
    results: parseProviderResults(provider.name, await response.json()),
  };
}

export async function discoverPublicJobs(
  source: PublicDiscoverySource,
  filters: JobSearchFilters,
  options: {
    fetcher?: typeof fetch;
    env?: PublicDiscoveryEnv;
  } = {}
): Promise<DiscoveredJob[]> {
  const fetcher = options.fetcher ?? fetch;
  const env = options.env ?? process.env;
  const queries = publicDiscoveryQueries(source, filters);
  const jobs = new Map<string, DiscoveredJob>();

  const responses = await Promise.all(
    queries.map(async (query) => ({
      query,
      response: await searchIndex(query, fetcher, env),
    }))
  );
  for (const { query, response } of responses) {
    for (const indexed of response.results) {
      const canonical = canonicalIndexedJobUrl(source, indexed.url);
      if (!canonical || isKnownExpired(`${indexed.title} ${indexed.snippet}`)) {
        continue;
      }
      const identity = createHash("sha256").update(canonical).digest("hex");
      if (jobs.has(identity)) continue;
      const parsed = splitIndexedTitle(source, indexed.title);
      jobs.set(identity, {
        externalId: `public:${identity}`,
        source,
        sourceUrl: canonical,
        title: parsed.title,
        company: parsed.company,
        location: filters.locations[0],
        description: indexed.snippet.slice(0, 1_500),
        metadata: {
          provenance: "public_discovery",
          discoveryLabel: "Public discovery",
          authenticatedConnection: "Connection required",
          provider: response.provider,
          discoveredAt: indexed.discoveredAt.toISOString(),
          query,
        },
      });
    }
  }
  return [...jobs.values()];
}

export class PublicDiscoveryAdapter implements JobSourceAdapter {
  readonly name: string;
  readonly canAutoApply = false;

  constructor(readonly source: PublicDiscoverySource) {
    this.name = `${source === "LINKEDIN" ? "LinkedIn" : "Naukri"} public discovery`;
  }

  search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    return discoverPublicJobs(this.source, filters);
  }

  async getJobDetails(): Promise<DiscoveredJob | null> {
    return null;
  }
}

export function publicDiscoveryCapability(env: PublicDiscoveryEnv = process.env) {
  const provider = configuredPublicSearchProvider(env);
  return {
    available: Boolean(provider),
    provider,
    status: provider ? ("available" as const) : ("setup_required" as const),
  };
}

export const __publicDiscoveryTest = {
  canonicalIndexedJobUrl,
  isKnownExpired,
};
