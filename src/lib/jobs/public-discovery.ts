import { createHash } from "node:crypto";
import type { JobSource } from "@prisma/client";
import prisma from "@/lib/db";
import type {
  DiscoveredJob,
  JobSearchFilters,
  JobSourceAdapter,
} from "./types";

export type PublicDiscoverySource =
  | "LINKEDIN"
  | "NAUKRI"
  | "FOUNDIT"
  | "INDEED"
  | "SHINE"
  | "TIMESJOBS"
  | "CUTSHORT"
  | "INSTAHYRE"
  | "WELLFOUND"
  | "INTERNSHALA"
  | "APNA"
  | "FRESHERSWORLD"
  | "HIRIST"
  | "IIMJOBS";

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

interface PublicSourceConfig {
  displayName: string;
  domains: string[];
  querySite: string;
  isIndividualJob: (url: URL) => boolean;
}

const PUBLIC_SOURCES: Record<PublicDiscoverySource, PublicSourceConfig> = {
  LINKEDIN: {
    displayName: "LinkedIn",
    domains: ["linkedin.com"],
    querySite: "linkedin.com/jobs/view",
    isIndividualJob: (url) => /^\/jobs\/view\/[^/]+/i.test(url.pathname),
  },
  NAUKRI: {
    displayName: "Naukri",
    domains: ["naukri.com"],
    querySite: "naukri.com/job-listings",
    isIndividualJob: (url) =>
      /\/(?:job-listings|job-listing)[-/][^/]+/i.test(url.pathname),
  },
  FOUNDIT: {
    displayName: "Foundit",
    domains: ["foundit.in"],
    querySite: "foundit.in/job",
    isIndividualJob: (url) =>
      /^\/(?:job|job-vacancy)\/[^/]+/i.test(url.pathname),
  },
  INDEED: {
    displayName: "Indeed India",
    domains: ["indeed.com"],
    querySite: "in.indeed.com/viewjob",
    isIndividualJob: (url) =>
      /^\/(?:viewjob|rc\/clkjob)/i.test(url.pathname) &&
      Boolean(url.searchParams.get("jk")),
  },
  SHINE: {
    displayName: "Shine",
    domains: ["shine.com"],
    querySite: "shine.com/jobs",
    isIndividualJob: (url) =>
      /^\/jobs\/[^/]+(?:\/[^/]+){1,}/i.test(url.pathname),
  },
  TIMESJOBS: {
    displayName: "TimesJobs",
    domains: ["timesjobs.com"],
    querySite: "timesjobs.com/job-detail",
    isIndividualJob: (url) => /^\/job-detail\/[^/]+/i.test(url.pathname),
  },
  CUTSHORT: {
    displayName: "Cutshort",
    domains: ["cutshort.io"],
    querySite: "cutshort.io/job",
    isIndividualJob: (url) => /^\/job\/[^/]+/i.test(url.pathname),
  },
  INSTAHYRE: {
    displayName: "Instahyre",
    domains: ["instahyre.com"],
    querySite: "instahyre.com/job",
    isIndividualJob: (url) => /^\/job[s-]\/?[^/]+/i.test(url.pathname),
  },
  WELLFOUND: {
    displayName: "Wellfound",
    domains: ["wellfound.com", "angel.co"],
    querySite: "wellfound.com/jobs",
    isIndividualJob: (url) => /^\/jobs\/\d+/i.test(url.pathname),
  },
  INTERNSHALA: {
    displayName: "Internshala",
    domains: ["internshala.com"],
    querySite: "internshala.com/job/detail",
    isIndividualJob: (url) =>
      /^\/(?:job|internship)\/detail\/[^/]+/i.test(url.pathname),
  },
  APNA: {
    displayName: "Apna",
    domains: ["apna.co"],
    querySite: "apna.co/job",
    isIndividualJob: (url) => /^\/job\/[^/]+/i.test(url.pathname),
  },
  FRESHERSWORLD: {
    displayName: "Freshersworld",
    domains: ["freshersworld.com"],
    querySite: "freshersworld.com/jobs",
    isIndividualJob: (url) => /^\/jobs\/[^/]+/i.test(url.pathname),
  },
  HIRIST: {
    displayName: "Hirist",
    domains: ["hirist.tech", "hirist.com"],
    querySite: "hirist.tech/j",
    isIndividualJob: (url) => /^\/j\/[^/]+/i.test(url.pathname),
  },
  IIMJOBS: {
    displayName: "iimjobs",
    domains: ["iimjobs.com"],
    querySite: "iimjobs.com/j",
    isIndividualJob: (url) => /^\/j\/[^/]+/i.test(url.pathname),
  },
};

export const PUBLIC_DISCOVERY_SOURCES = Object.freeze(
  Object.keys(PUBLIC_SOURCES) as PublicDiscoverySource[]
);

const SEARCH_CACHE_TTL_MS = 15 * 60_000;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const searchCache = new Map<
  string,
  { expiresAt: number; value: { provider: ProviderName; results: IndexedResult[] } }
>();
const globalRequestTimes: number[] = [];

export type PublicDiscoveryErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "TEMPORARILY_UNAVAILABLE"
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

function serpApiKey(env: PublicDiscoveryEnv): string | undefined {
  return env.SERPAPI_KEY ?? env.SERPAPI_API_KEY;
}

export function configuredPublicSearchProviders(
  env: PublicDiscoveryEnv = process.env
): ProviderName[] {
  const providers: ProviderName[] = [];
  if (env.BRAVE_SEARCH_API_KEY) providers.push("brave");
  if (env.BING_SEARCH_API_KEY) providers.push("bing");
  if (env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID) providers.push("google_cse");
  if (serpApiKey(env)) providers.push("serpapi");
  return providers;
}

export function configuredPublicSearchProvider(
  env: PublicDiscoveryEnv = process.env
): ProviderName | null {
  return configuredPublicSearchProviders(env)[0] ?? null;
}

function providerConfigs(env: PublicDiscoveryEnv): SearchProviderConfig[] {
  return configuredPublicSearchProviders(env).map<SearchProviderConfig>((name) => {
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
      } as SearchProviderConfig;
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
        extraParams: {
          count: "20",
          freshness: "Month",
          responseFilter: "Webpages",
        },
      } as SearchProviderConfig;
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
      } as SearchProviderConfig;
    }
    return {
      name,
      endpoint: "https://serpapi.com/search.json",
      headers: { Accept: "application/json" },
      queryParam: "q",
      extraParams: {
        api_key: serpApiKey(env)!,
        engine: "google",
        num: "20",
        tbs: "qdr:m",
      },
    } as SearchProviderConfig;
  });
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
    const pages = root.webPages as
      | { value?: Array<Record<string, unknown>> }
      | undefined;
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

function hostAllowed(host: string, domains: string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
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
  const config = PUBLIC_SOURCES[source];
  if (!hostAllowed(url.hostname.toLowerCase(), config.domains)) return null;
  if (!config.isIndividualJob(url)) return null;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      [
        "trk",
        "trackingid",
        "refid",
        "ref",
        "src",
        "source",
        "campaign",
        "from",
      ].includes(key.toLowerCase())
    ) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function isKnownExpired(text: string): boolean {
  return /no longer accepting applications|job has expired|position has been filled|applications? closed|vacancy closed/i.test(
    text
  );
}

function splitIndexedTitle(
  source: PublicDiscoverySource,
  value: string
): { title: string; company: string } {
  const platformNames =
    "LinkedIn|Naukri(?:\\.com)?|Foundit|Indeed|Shine|TimesJobs|Cutshort|Instahyre|Wellfound|Internshala|Apna|Freshersworld|Hirist|iimjobs";
  const cleaned = value
    .replace(new RegExp(`\\s*[|–-]\\s*(?:${platformNames}).*$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
  const atMatch = cleaned.match(/^(.+?)\s+(?:at|[-–])\s+(.+)$/i);
  const naukriMatch = cleaned.match(
    /^(.+?)\s+job\s+(?:in|at)\s+(.+?)(?:\s+at\s+.+)?$/i
  );
  const match = naukriMatch ?? atMatch;
  return {
    title: match?.[1]?.trim() || cleaned || `${PUBLIC_SOURCES[source].displayName} job`,
    company:
      match?.[2]?.trim() ||
      `Employer shown on ${PUBLIC_SOURCES[source].displayName}`,
  };
}

function publicDiscoveryQueries(
  source: PublicDiscoverySource,
  filters: JobSearchFilters
): string[] {
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
      `site:${PUBLIC_SOURCES[source].querySite} "${title}" ${
        location ? `"${location}"` : ""
      } India jobs`
  );
}

async function enforceGlobalRateLimit(env: PublicDiscoveryEnv): Promise<void> {
  const now = Date.now();
  const windowStartMs = now - 60_000;
  const configuredLimit = Number(env.PUBLIC_SEARCH_GLOBAL_REQUESTS_PER_MINUTE);
  const limit =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? Math.min(configuredLimit, 300)
      : 60;

  let count: number;
  if (
    process.env.NODE_ENV !== "test" &&
    env.DATABASE_URL &&
    env.RATE_LIMIT_DURABLE !== "false"
  ) {
    try {
      const rows = await prisma.$queryRaw<Array<{ request_count: number }>>`
        INSERT INTO rate_limit_buckets (
          bucket_key, request_count, window_start, window_ms
        )
        VALUES (
          'public-search:global', 1, ${new Date(now)}, 60000
        )
        ON CONFLICT (bucket_key)
        DO UPDATE SET
          request_count = CASE
            WHEN rate_limit_buckets.window_start < ${new Date(windowStartMs)}
              THEN 1
            ELSE rate_limit_buckets.request_count + 1
          END,
          window_start = CASE
            WHEN rate_limit_buckets.window_start < ${new Date(windowStartMs)}
              THEN ${new Date(now)}
            ELSE rate_limit_buckets.window_start
          END,
          window_ms = 60000
        RETURNING request_count
      `;
      count = rows[0]?.request_count ?? 1;
    } catch {
      while (
        globalRequestTimes[0] &&
        globalRequestTimes[0] < windowStartMs
      ) {
        globalRequestTimes.shift();
      }
      globalRequestTimes.push(now);
      count = globalRequestTimes.length;
    }
  } else {
    while (globalRequestTimes[0] && globalRequestTimes[0] < windowStartMs) {
      globalRequestTimes.shift();
    }
    globalRequestTimes.push(now);
    count = globalRequestTimes.length;
  }
  if (count > limit) {
    throw new PublicDiscoveryError(
      "RATE_LIMITED",
      "Public discovery is temporarily rate limited. Try again shortly."
    );
  }
}

function cacheKey(query: string, providers: SearchProviderConfig[]): string {
  return createHash("sha256")
    .update(`${providers.map((provider) => provider.name).join(",")}:${query}`)
    .digest("hex");
}

function getCached(
  key: string
): { provider: ProviderName; results: IndexedResult[] } | null {
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCached(
  key: string,
  value: { provider: ProviderName; results: IndexedResult[] }
): void {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value as string | undefined;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    value,
  });
}

function errorForResponse(response: Response): PublicDiscoveryError {
  if (response.status === 429) {
    const remaining =
      response.headers.get("x-ratelimit-remaining") ??
      response.headers.get("x-ratelimit-remaining-requests");
    return new PublicDiscoveryError(
      remaining === "0" ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
      remaining === "0"
        ? "Public-discovery search quota is exhausted."
        : "Public-discovery search provider is rate limited."
    );
  }
  return new PublicDiscoveryError(
    "PROVIDER_ERROR",
    `Public-discovery provider returned HTTP ${response.status}.`
  );
}

async function searchIndex(
  query: string,
  fetcher: typeof fetch,
  env: PublicDiscoveryEnv
): Promise<{ provider: ProviderName; results: IndexedResult[] }> {
  const providers = providerConfigs(env);
  if (providers.length === 0) {
    throw new PublicDiscoveryError(
      "NOT_CONFIGURED",
      "Public discovery is unavailable because no approved search provider is configured."
    );
  }
  const key = cacheKey(query, providers);
  const cached = getCached(key);
  if (cached) return cached;

  const errors: PublicDiscoveryError[] = [];
  for (const provider of providers) {
    await enforceGlobalRateLimit(env);
    const url = new URL(provider.endpoint);
    url.searchParams.set(provider.queryParam, query);
    for (const [param, value] of Object.entries(provider.extraParams)) {
      url.searchParams.set(param, value);
    }
    try {
      const response = await fetcher(url, {
        headers: provider.headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        errors.push(errorForResponse(response));
        continue;
      }
      const result = {
        provider: provider.name,
        results: parseProviderResults(provider.name, await response.json()),
      };
      setCached(key, result);
      return result;
    } catch (error) {
      if (error instanceof PublicDiscoveryError) {
        errors.push(error);
      } else {
        errors.push(
          new PublicDiscoveryError(
            "TEMPORARILY_UNAVAILABLE",
            "Public-discovery provider did not respond before the safe timeout."
          )
        );
      }
    }
  }

  const preferred =
    errors.find((error) => error.code === "QUOTA_EXHAUSTED") ??
    errors.find((error) => error.code === "RATE_LIMITED") ??
    errors.find((error) => error.code === "TEMPORARILY_UNAVAILABLE") ??
    errors[0];
  throw (
    preferred ??
    new PublicDiscoveryError(
      "PROVIDER_ERROR",
      "All configured public-discovery providers failed."
    )
  );
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
        source: source as JobSource,
        sourceUrl: canonical,
        title: parsed.title,
        company: parsed.company,
        location: filters.locations[0],
        description: indexed.snippet.slice(0, 1_500),
        metadata: {
          provenance: "public_discovery",
          discoveryLabel: "Public discovery available",
          verificationState: "indexed_public_metadata",
          authenticatedConnection: "Authenticated connection required",
          provider: response.provider,
          discoveredAt: indexed.discoveredAt.toISOString(),
          query,
          publicSource: PUBLIC_SOURCES[source].displayName,
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
    this.name = `${PUBLIC_SOURCES[source].displayName} public discovery`;
  }

  search(filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    return discoverPublicJobs(this.source, filters);
  }

  async getJobDetails(): Promise<DiscoveredJob | null> {
    return null;
  }
}

export function publicDiscoveryCapability(env: PublicDiscoveryEnv = process.env) {
  const providers = configuredPublicSearchProviders(env);
  return {
    available: providers.length > 0,
    provider: providers[0] ?? null,
    providers,
    status: providers.length > 0 ? ("available" as const) : ("setup_required" as const),
  };
}

export const __publicDiscoveryTest = {
  canonicalIndexedJobUrl,
  isKnownExpired,
  resetProtectionState() {
    searchCache.clear();
    globalRequestTimes.splice(0);
  },
};
