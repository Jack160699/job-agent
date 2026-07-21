import { createHash } from "node:crypto";
import type { JobSource } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import { extractLocationHint, inferTitleFamily } from "./normalization";
import type {
  DiscoveredJob,
  JobSearchFilters,
  JobSourceAdapter,
} from "./types";

export type PublicDiscoverySource =
  | "LINKEDIN"
  | "NAUKRI"
  | "INDEED"
  | "FOUNDIT"
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

export type ProviderName =
  | "serper"
  | "brave"
  | "bing"
  | "google_cse"
  | "serpapi";

type PublicDiscoveryEnv = Record<string, string | undefined>;

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

/** LinkedIn / Naukri / Indeed first so shared run budget prefers primary boards. */
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
  INDEED: {
    displayName: "Indeed India",
    domains: ["indeed.com"],
    querySite: "in.indeed.com/viewjob",
    isIndividualJob: (url) =>
      /^\/(?:viewjob|rc\/clkjob)/i.test(url.pathname) &&
      Boolean(url.searchParams.get("jk")),
  },
  FOUNDIT: {
    displayName: "Foundit",
    domains: ["foundit.in"],
    querySite: "foundit.in/job",
    isIndividualJob: (url) =>
      /^\/(?:job|job-vacancy)\/[^/]+/i.test(url.pathname),
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

const PROFESSION_SOURCE_ORDER: Record<string, PublicDiscoverySource[]> = {
  software_engineering: [
    "LINKEDIN",
    "NAUKRI",
    "CUTSHORT",
    "INSTAHYRE",
    "HIRIST",
    "WELLFOUND",
    "INDEED",
    "FOUNDIT",
  ],
  frontend: [
    "LINKEDIN",
    "NAUKRI",
    "CUTSHORT",
    "INSTAHYRE",
    "HIRIST",
    "WELLFOUND",
    "INDEED",
    "FOUNDIT",
  ],
  backend: [
    "LINKEDIN",
    "NAUKRI",
    "CUTSHORT",
    "INSTAHYRE",
    "HIRIST",
    "WELLFOUND",
    "INDEED",
    "FOUNDIT",
  ],
  operations_analysis: [
    "NAUKRI",
    "LINKEDIN",
    "INDEED",
    "FOUNDIT",
    "SHINE",
    "TIMESJOBS",
    "IIMJOBS",
    "APNA",
  ],
  nursing_healthcare: [
    "INDEED",
    "NAUKRI",
    "LINKEDIN",
    "APNA",
    "FRESHERSWORLD",
    "FOUNDIT",
    "SHINE",
    "INTERNSHALA",
  ],
  banking: [
    "NAUKRI",
    "LINKEDIN",
    "INDEED",
    "IIMJOBS",
    "FOUNDIT",
    "SHINE",
    "TIMESJOBS",
    "APNA",
  ],
  teaching_education: [
    "INDEED",
    "NAUKRI",
    "LINKEDIN",
    "APNA",
    "FRESHERSWORLD",
    "INTERNSHALA",
    "SHINE",
    "FOUNDIT",
  ],
  technician_apprentice: [
    "NAUKRI",
    "INDEED",
    "APNA",
    "FRESHERSWORLD",
    "LINKEDIN",
    "FOUNDIT",
    "SHINE",
    "TIMESJOBS",
  ],
};

export function orderedPublicDiscoverySources(
  titles: string[] = []
): PublicDiscoverySource[] {
  const family = inferTitleFamily(titles);
  const preferred = family ? PROFESSION_SOURCE_ORDER[family] : null;
  const ordered: PublicDiscoverySource[] = [];
  const seen = new Set<PublicDiscoverySource>();
  for (const source of preferred ?? []) {
    if (!seen.has(source)) {
      ordered.push(source);
      seen.add(source);
    }
  }
  for (const source of PUBLIC_DISCOVERY_SOURCES) {
    if (!seen.has(source)) {
      ordered.push(source);
      seen.add(source);
    }
  }
  return ordered;
}

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60_000;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const DEFAULT_MAX_QUERIES_PER_RUN = 8;
const DEFAULT_MAX_QUERIES_PER_USER_DAY = 20;
const DEFAULT_MAX_QUERIES_PER_MONTH = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_SAFE_RETRIES = 2;

const serperOrganicSchema = z.object({
  organic: z
    .array(
      z
        .object({
          title: z.string().optional(),
          link: z.string().optional(),
          snippet: z.string().optional(),
        })
        .passthrough()
    )
    .optional()
    .default([]),
});

type ErrorCategory =
  | "none"
  | "authentication_failed"
  | "quota_exhausted"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "provider_error"
  | "empty_results"
  | "not_configured"
  | "budget_exhausted";

export type ProviderHealthStatus =
  | "not_configured"
  | "configured"
  | "healthy"
  | "authentication_failed"
  | "rate_limited"
  | "quota_exhausted"
  | "temporarily_unavailable"
  | "disabled";

export interface ProviderHealthSnapshot {
  name: ProviderName;
  configured: boolean;
  status: ProviderHealthStatus;
  lastSuccessfulRequestAt: string | null;
  lastDurationMs: number | null;
  lastResultCount: number | null;
  lastErrorCategory: ErrorCategory;
  searchesUsed: number;
  cacheHits: number;
}

interface ProviderRuntimeState {
  status: ProviderHealthStatus;
  lastSuccessfulRequestAt: Date | null;
  lastDurationMs: number | null;
  lastResultCount: number | null;
  lastErrorCategory: ErrorCategory;
  searchesUsed: number;
  cacheHits: number;
  authFailed: boolean;
}

const providerState = new Map<ProviderName, ProviderRuntimeState>();
const authFailedProviders = new Set<ProviderName>();

const searchCache = new Map<
  string,
  {
    expiresAt: number;
    value: { provider: ProviderName; results: IndexedResult[] };
  }
>();
const globalRequestTimes: number[] = [];

interface RunBudgetState {
  remaining: number;
  userId: string | null;
  startedAt: number;
}

let runBudget: RunBudgetState = {
  remaining: DEFAULT_MAX_QUERIES_PER_RUN,
  userId: null,
  startedAt: 0,
};
let publicResultsAccumulated = 0;

export type PublicDiscoveryErrorCode =
  | "NOT_CONFIGURED"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "TEMPORARILY_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "PROVIDER_ERROR"
  | "RUN_BUDGET_EXCEEDED"
  | "USER_DAILY_LIMIT";

export class PublicDiscoveryError extends Error {
  constructor(
    public readonly code: PublicDiscoveryErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PublicDiscoveryError";
  }
}

function envNumber(
  env: PublicDiscoveryEnv,
  key: string,
  fallback: number
): number {
  const raw = Number(env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function cacheTtlMs(env: PublicDiscoveryEnv): number {
  return envNumber(env, "PUBLIC_SEARCH_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
}

function ensureProviderState(name: ProviderName): ProviderRuntimeState {
  const existing = providerState.get(name);
  if (existing) return existing;
  const created: ProviderRuntimeState = {
    status: "not_configured",
    lastSuccessfulRequestAt: null,
    lastDurationMs: null,
    lastResultCount: null,
    lastErrorCategory: "none",
    searchesUsed: 0,
    cacheHits: 0,
    authFailed: false,
  };
  providerState.set(name, created);
  return created;
}

function recordProviderOutcome(
  name: ProviderName,
  outcome: {
    ok: boolean;
    durationMs: number;
    resultCount?: number;
    category?: ErrorCategory;
    fromCache?: boolean;
  }
): void {
  const state = ensureProviderState(name);
  state.lastDurationMs = outcome.durationMs;
  if (outcome.fromCache) {
    state.cacheHits += 1;
    return;
  }
  if (outcome.ok) {
    state.status = "healthy";
    state.lastSuccessfulRequestAt = new Date();
    state.lastResultCount = outcome.resultCount ?? 0;
    state.lastErrorCategory =
      (outcome.resultCount ?? 0) === 0 ? "empty_results" : "none";
    state.searchesUsed += 1;
    state.authFailed = false;
    authFailedProviders.delete(name);
    return;
  }
  const category = outcome.category ?? "provider_error";
  state.lastErrorCategory = category;
  state.searchesUsed += 1;
  if (category === "authentication_failed") {
    state.status = "authentication_failed";
    state.authFailed = true;
    authFailedProviders.add(name);
  } else if (category === "quota_exhausted") {
    state.status = "quota_exhausted";
  } else if (category === "rate_limited") {
    state.status = "rate_limited";
  } else {
    state.status = "temporarily_unavailable";
  }
}

function serpApiKey(env: PublicDiscoveryEnv): string | undefined {
  return env.SERPAPI_KEY ?? env.SERPAPI_API_KEY;
}

export function configuredPublicSearchProviders(
  env: PublicDiscoveryEnv = process.env
): ProviderName[] {
  const providers: ProviderName[] = [];
  if (env.SERPER_API_KEY && !authFailedProviders.has("serper")) {
    providers.push("serper");
  }
  if (env.BRAVE_SEARCH_API_KEY && !authFailedProviders.has("brave")) {
    providers.push("brave");
  }
  if (env.BING_SEARCH_API_KEY && !authFailedProviders.has("bing")) {
    providers.push("bing");
  }
  if (
    env.GOOGLE_CSE_API_KEY &&
    env.GOOGLE_CSE_ID &&
    !authFailedProviders.has("google_cse")
  ) {
    providers.push("google_cse");
  }
  // Invalid historical SerpApi keys must not delay Serper. Only use SerpApi when
  // Serper is absent and the key has not already failed authentication.
  if (
    serpApiKey(env) &&
    !env.SERPER_API_KEY &&
    !authFailedProviders.has("serpapi")
  ) {
    providers.push("serpapi");
  }
  return providers;
}

export function configuredPublicSearchProvider(
  env: PublicDiscoveryEnv = process.env
): ProviderName | null {
  return configuredPublicSearchProviders(env)[0] ?? null;
}

export function beginPublicDiscoveryRun(
  userId: string | null = null,
  env: PublicDiscoveryEnv = process.env
): void {
  runBudget = {
    remaining: envNumber(
      env,
      "PUBLIC_SEARCH_MAX_QUERIES_PER_RUN",
      DEFAULT_MAX_QUERIES_PER_RUN
    ),
    userId,
    startedAt: Date.now(),
  };
  publicResultsAccumulated = 0;
}

function notePublicDiscoveryYield(
  count: number,
  env: PublicDiscoveryEnv
): void {
  publicResultsAccumulated += count;
  const enough = envNumber(env, "PUBLIC_SEARCH_ENOUGH_RESULTS", 24);
  if (publicResultsAccumulated >= enough) {
    runBudget.remaining = 0;
  }
}

function claimRunBudget(): boolean {
  if (runBudget.remaining <= 0) return false;
  runBudget.remaining -= 1;
  return true;
}

function releaseRunBudget(): void {
  runBudget.remaining += 1;
}

async function claimUserDailyBudget(
  env: PublicDiscoveryEnv,
  userId: string | null
): Promise<boolean> {
  if (!userId) return true;
  const limit = envNumber(
    env,
    "PUBLIC_SEARCH_MAX_QUERIES_PER_USER_DAY",
    DEFAULT_MAX_QUERIES_PER_USER_DAY
  );
  const now = Date.now();
  const dayMs = 24 * 60 * 60_000;
  const windowStartMs = now - dayMs;
  const bucketKey = `public-search:user:${userId}:day`;

  if (
    process.env.NODE_ENV === "test" ||
    !env.DATABASE_URL ||
    env.RATE_LIMIT_DURABLE === "false"
  ) {
    return true;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ request_count: number }>>`
      INSERT INTO rate_limit_buckets (
        bucket_key, request_count, window_start, window_ms
      )
      VALUES (
        ${bucketKey}, 1, ${new Date(now)}, ${dayMs}
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
        window_ms = ${dayMs}
      RETURNING request_count
    `;
    return (rows[0]?.request_count ?? 1) <= limit;
  } catch {
    return true;
  }
}

async function claimMonthlyBudget(env: PublicDiscoveryEnv): Promise<boolean> {
  const limit = envNumber(
    env,
    "PUBLIC_SEARCH_MAX_QUERIES_PER_MONTH",
    DEFAULT_MAX_QUERIES_PER_MONTH
  );
  const now = Date.now();
  const monthMs = 31 * 24 * 60 * 60_000;
  const windowStartMs = now - monthMs;

  if (
    process.env.NODE_ENV === "test" ||
    !env.DATABASE_URL ||
    env.RATE_LIMIT_DURABLE === "false"
  ) {
    return true;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ request_count: number }>>`
      INSERT INTO rate_limit_buckets (
        bucket_key, request_count, window_start, window_ms
      )
      VALUES (
        'public-search:global:month', 1, ${new Date(now)}, ${monthMs}
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
        window_ms = ${monthMs}
      RETURNING request_count
    `;
    return (rows[0]?.request_count ?? 1) <= limit;
  } catch {
    return true;
  }
}

function parseProviderResults(
  provider: ProviderName,
  payload: unknown
): IndexedResult[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  const now = new Date();
  if (provider === "serper") {
    const parsed = serperOrganicSchema.safeParse(payload);
    if (!parsed.success) {
      throw new PublicDiscoveryError(
        "INVALID_RESPONSE",
        "Public-discovery provider returned an invalid response shape."
      );
    }
    return parsed.data.organic.map((item) => ({
      title: String(item.title ?? ""),
      url: String(item.link ?? ""),
      snippet: String(item.snippet ?? ""),
      discoveredAt: now,
    }));
  }
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
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function looksLikeSearchResultsPage(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  if (
    /\/(?:jobs?|search|jobsearch|jobs-search|find-jobs?)\/?$/i.test(path) ||
    /\/(?:jobs?|search)\/(?:results|listing|listings)?\/?$/i.test(path)
  ) {
    return true;
  }
  const q = url.searchParams;
  if (
    q.has("q") &&
    !q.has("jk") &&
    /indeed\.com$/i.test(url.hostname) &&
    !/^\/(?:viewjob|rc\/clkjob)/i.test(path)
  ) {
    return true;
  }
  return false;
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
  if (looksLikeSearchResultsPage(url)) return null;
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
    title:
      match?.[1]?.trim() ||
      cleaned ||
      `${PUBLIC_SOURCES[source].displayName} job`,
    company:
      match?.[2]?.trim() ||
      `Employer shown on ${PUBLIC_SOURCES[source].displayName}`,
  };
}

function publicDiscoveryQueries(
  source: PublicDiscoverySource,
  filters: JobSearchFilters
): string[] {
  const titleCandidates = [
    ...(filters.queries?.map((query) => query.title) ?? []),
    ...filters.titles,
  ]
    .map((title) => title.trim())
    .filter(Boolean);
  const uniqueTitles = [...new Set(titleCandidates)].slice(0, 3);
  if (uniqueTitles.length === 0) return [];

  const location =
    filters.queries?.[0]?.location ?? filters.locations[0] ?? null;
  const titleClause =
    uniqueTitles.length === 1
      ? `"${uniqueTitles[0]}"`
      : `(${uniqueTitles.map((title) => `"${title}"`).join(" OR ")})`;

  return [
    `site:${PUBLIC_SOURCES[source].querySite} ${titleClause}${
      location ? ` "${location}"` : ""
    } India`,
  ];
}

async function enforceGlobalRateLimit(env: PublicDiscoveryEnv): Promise<void> {
  const now = Date.now();
  const windowStartMs = now - 60_000;
  const limit = Math.min(
    envNumber(env, "PUBLIC_SEARCH_GLOBAL_REQUESTS_PER_MINUTE", 60),
    300
  );

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

function cacheKey(query: string, providers: ProviderName[]): string {
  return createHash("sha256")
    .update(`${providers.join(",")}:${query}`)
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
  value: { provider: ProviderName; results: IndexedResult[] },
  ttlMs: number
): void {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value as string | undefined;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function errorForResponse(response: Response): PublicDiscoveryError {
  if (response.status === 401 || response.status === 403) {
    return new PublicDiscoveryError(
      "AUTHENTICATION_FAILED",
      "Public-discovery provider authentication failed."
    );
  }
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

function categoryForError(error: PublicDiscoveryError): ErrorCategory {
  switch (error.code) {
    case "AUTHENTICATION_FAILED":
      return "authentication_failed";
    case "QUOTA_EXHAUSTED":
      return "quota_exhausted";
    case "RATE_LIMITED":
      return "rate_limited";
    case "TEMPORARILY_UNAVAILABLE":
      return "timeout";
    case "INVALID_RESPONSE":
      return "invalid_response";
    case "NOT_CONFIGURED":
      return "not_configured";
    case "RUN_BUDGET_EXCEEDED":
    case "USER_DAILY_LIMIT":
      return "budget_exhausted";
    default:
      return "provider_error";
  }
}

function isTransientError(error: PublicDiscoveryError): boolean {
  return (
    error.code === "RATE_LIMITED" ||
    error.code === "TEMPORARILY_UNAVAILABLE"
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeProviderSearch(
  provider: ProviderName,
  query: string,
  fetcher: typeof fetch,
  env: PublicDiscoveryEnv
): Promise<IndexedResult[]> {
  const timeoutMs = envNumber(
    env,
    "PUBLIC_SEARCH_REQUEST_TIMEOUT_MS",
    DEFAULT_REQUEST_TIMEOUT_MS
  );
  const started = Date.now();

  const attempt = async (): Promise<IndexedResult[]> => {
    if (provider === "serper") {
      const response = await fetcher("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": env.SERPER_API_KEY!,
        },
        body: JSON.stringify({
          q: query,
          num: 10,
          gl: "in",
          hl: "en",
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw errorForResponse(response);
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new PublicDiscoveryError(
          "INVALID_RESPONSE",
          "Public-discovery provider returned invalid JSON."
        );
      }
      return parseProviderResults("serper", json);
    }

    const url = new URL(
      provider === "brave"
        ? "https://api.search.brave.com/res/v1/web/search"
        : provider === "bing"
          ? "https://api.bing.microsoft.com/v7.0/search"
          : provider === "google_cse"
            ? "https://customsearch.googleapis.com/customsearch/v1"
            : "https://serpapi.com/search.json"
    );
    url.searchParams.set("q", query);
    const headers: Record<string, string> = { Accept: "application/json" };

    if (provider === "brave") {
      headers["X-Subscription-Token"] = env.BRAVE_SEARCH_API_KEY!;
      url.searchParams.set("count", "20");
      url.searchParams.set("freshness", "pm");
    } else if (provider === "bing") {
      headers["Ocp-Apim-Subscription-Key"] = env.BING_SEARCH_API_KEY!;
      url.searchParams.set("count", "20");
      url.searchParams.set("freshness", "Month");
      url.searchParams.set("responseFilter", "Webpages");
    } else if (provider === "google_cse") {
      url.searchParams.set("key", env.GOOGLE_CSE_API_KEY!);
      url.searchParams.set("cx", env.GOOGLE_CSE_ID!);
      url.searchParams.set("num", "10");
      url.searchParams.set("dateRestrict", "m1");
    } else {
      url.searchParams.set("api_key", serpApiKey(env)!);
      url.searchParams.set("engine", "google");
      url.searchParams.set("num", "20");
      url.searchParams.set("tbs", "qdr:m");
    }

    const response = await fetcher(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw errorForResponse(response);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new PublicDiscoveryError(
        "INVALID_RESPONSE",
        "Public-discovery provider returned invalid JSON."
      );
    }
    return parseProviderResults(provider, json);
  };

  let lastError: PublicDiscoveryError | null = null;
  for (let retry = 0; retry <= MAX_SAFE_RETRIES; retry += 1) {
    try {
      const results = await attempt();
      recordProviderOutcome(provider, {
        ok: true,
        durationMs: Date.now() - started,
        resultCount: results.length,
      });
      return results;
    } catch (error) {
      const mapped =
        error instanceof PublicDiscoveryError
          ? error
          : new PublicDiscoveryError(
              "TEMPORARILY_UNAVAILABLE",
              "Public-discovery provider did not respond before the safe timeout."
            );
      lastError = mapped;
      if (
        mapped.code === "AUTHENTICATION_FAILED" ||
        !isTransientError(mapped) ||
        retry === MAX_SAFE_RETRIES
      ) {
        recordProviderOutcome(provider, {
          ok: false,
          durationMs: Date.now() - started,
          category: categoryForError(mapped),
        });
        throw mapped;
      }
      await sleep(250 * 2 ** retry);
    }
  }
  throw (
    lastError ??
    new PublicDiscoveryError(
      "PROVIDER_ERROR",
      "Public-discovery provider failed."
    )
  );
}

async function searchIndex(
  query: string,
  fetcher: typeof fetch,
  env: PublicDiscoveryEnv
): Promise<{ provider: ProviderName; results: IndexedResult[]; fromCache: boolean }> {
  const providers = configuredPublicSearchProviders(env);
  if (providers.length === 0) {
    throw new PublicDiscoveryError(
      "NOT_CONFIGURED",
      "Public discovery is unavailable because no approved search provider is configured."
    );
  }
  const key = cacheKey(query, providers);
  const cached = getCached(key);
  if (cached) {
    recordProviderOutcome(cached.provider, {
      ok: true,
      durationMs: 0,
      resultCount: cached.results.length,
      fromCache: true,
    });
    return { ...cached, fromCache: true };
  }

  if (!claimRunBudget()) {
    throw new PublicDiscoveryError(
      "RUN_BUDGET_EXCEEDED",
      "Public-discovery search budget for this agent run is exhausted."
    );
  }

  const userOk = await claimUserDailyBudget(env, runBudget.userId);
  if (!userOk) {
    releaseRunBudget();
    throw new PublicDiscoveryError(
      "USER_DAILY_LIMIT",
      "Daily public-discovery search limit reached for this account."
    );
  }

  const monthOk = await claimMonthlyBudget(env);
  if (!monthOk) {
    releaseRunBudget();
    throw new PublicDiscoveryError(
      "QUOTA_EXHAUSTED",
      "Public-discovery monthly safety limit is exhausted."
    );
  }

  const errors: PublicDiscoveryError[] = [];
  for (const provider of providers) {
    if (authFailedProviders.has(provider)) continue;
    await enforceGlobalRateLimit(env);
    try {
      const results = await executeProviderSearch(provider, query, fetcher, env);
      const result = { provider, results };
      setCached(key, result, cacheTtlMs(env));
      return { ...result, fromCache: false };
    } catch (error) {
      if (error instanceof PublicDiscoveryError) {
        errors.push(error);
        if (error.code === "AUTHENTICATION_FAILED") {
          continue;
        }
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
    errors.find((error) => error.code === "AUTHENTICATION_FAILED") ??
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

  for (const query of queries) {
    let response: {
      provider: ProviderName;
      results: IndexedResult[];
      fromCache: boolean;
    };
    try {
      response = await searchIndex(query, fetcher, env);
    } catch (error) {
      if (
        error instanceof PublicDiscoveryError &&
        (error.code === "RUN_BUDGET_EXCEEDED" ||
          error.code === "USER_DAILY_LIMIT")
      ) {
        return [...jobs.values()];
      }
      throw error;
    }

    for (const indexed of response.results) {
      const canonical = canonicalIndexedJobUrl(source, indexed.url);
      if (!canonical || isKnownExpired(`${indexed.title} ${indexed.snippet}`)) {
        continue;
      }
      const identity = createHash("sha256").update(canonical).digest("hex");
      if (jobs.has(identity)) continue;
      const parsed = splitIndexedTitle(source, indexed.title);
      const locationHint = extractLocationHint(
        `${indexed.title} ${indexed.snippet}`,
        filters.locations
      );
      jobs.set(identity, {
        externalId: `public:${identity}`,
        source: source as JobSource,
        sourceUrl: canonical,
        title: parsed.title,
        company: parsed.company,
        location: locationHint,
        description: indexed.snippet.slice(0, 1_500),
        metadata: {
          provenance: "public_discovery",
          discoveryLabel: "Public discovery",
          discoveryMethod: "public_index",
          verificationState: "indexed_public_metadata",
          authenticatedConnection: "Authentication still required for protected functions",
          easyApplyClaim: false,
          provider: response.provider,
          discoveredAt: indexed.discoveredAt.toISOString(),
          query,
          publicSource: PUBLIC_SOURCES[source].displayName,
          fromCache: response.fromCache,
          locationSource: locationHint ? "indexed_text" : "unknown",
        },
      });
    }
  }
  notePublicDiscoveryYield(jobs.size, env);
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

export function getPublicSearchProviderHealth(
  env: PublicDiscoveryEnv = process.env
): ProviderHealthSnapshot[] {
  const names: ProviderName[] = [
    "serper",
    "brave",
    "bing",
    "google_cse",
    "serpapi",
  ];
  const configured = new Set(configuredPublicSearchProviders(env));
  // Include auth-failed configured keys so UI can show authentication_failed.
  const keyPresent: Record<ProviderName, boolean> = {
    serper: Boolean(env.SERPER_API_KEY),
    brave: Boolean(env.BRAVE_SEARCH_API_KEY),
    bing: Boolean(env.BING_SEARCH_API_KEY),
    google_cse: Boolean(env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID),
    serpapi: Boolean(serpApiKey(env)),
  };

  return names.map((name) => {
    const state = ensureProviderState(name);
    const isConfigured = keyPresent[name];
    let status: ProviderHealthStatus = "not_configured";
    if (isConfigured) {
      if (name === "serpapi" && env.SERPER_API_KEY) {
        status = authFailedProviders.has(name)
          ? "authentication_failed"
          : "disabled";
      } else if (authFailedProviders.has(name) || state.authFailed) {
        status = "authentication_failed";
      } else if (state.status !== "not_configured") {
        status = state.status;
      } else {
        status = "configured";
      }
    }
    return {
      name,
      configured: isConfigured,
      status,
      lastSuccessfulRequestAt:
        state.lastSuccessfulRequestAt?.toISOString() ?? null,
      lastDurationMs: state.lastDurationMs,
      lastResultCount: state.lastResultCount,
      lastErrorCategory: state.lastErrorCategory,
      searchesUsed: state.searchesUsed,
      cacheHits: state.cacheHits,
    };
  });
}

export function publicDiscoveryCapability(
  env: PublicDiscoveryEnv = process.env
) {
  const providers = configuredPublicSearchProviders(env);
  const health = getPublicSearchProviderHealth(env);
  const primary = health.find((item) => item.name === providers[0]) ?? null;
  const serper = health.find((item) => item.name === "serper") ?? null;
  return {
    available: providers.length > 0,
    provider: providers[0] ?? null,
    providers,
    status: providers.length > 0 ? ("available" as const) : ("setup_required" as const),
    primaryHealth: primary,
    serper,
    providerHealth: health,
    creditLimits: {
      maxQueriesPerRun: envNumber(
        env,
        "PUBLIC_SEARCH_MAX_QUERIES_PER_RUN",
        DEFAULT_MAX_QUERIES_PER_RUN
      ),
      maxQueriesPerUserDay: envNumber(
        env,
        "PUBLIC_SEARCH_MAX_QUERIES_PER_USER_DAY",
        DEFAULT_MAX_QUERIES_PER_USER_DAY
      ),
      cacheTtlMs: cacheTtlMs(env),
      runBudgetRemaining: runBudget.remaining,
    },
  };
}

export const __publicDiscoveryTest = {
  canonicalIndexedJobUrl,
  isIndividualJobUrl: (
    source: PublicDiscoverySource,
    value: string
  ): boolean => Boolean(canonicalIndexedJobUrl(source, value)),
  isKnownExpired,
  publicDiscoveryQueries,
  looksLikeSearchResultsPage: (value: string) => {
    try {
      return looksLikeSearchResultsPage(new URL(value));
    } catch {
      return true;
    }
  },
  resetProtectionState() {
    searchCache.clear();
    globalRequestTimes.splice(0);
    authFailedProviders.clear();
    providerState.clear();
    beginPublicDiscoveryRun(null, {
      PUBLIC_SEARCH_MAX_QUERIES_PER_RUN: String(DEFAULT_MAX_QUERIES_PER_RUN),
    });
  },
  markAuthFailed(provider: ProviderName) {
    authFailedProviders.add(provider);
    const state = ensureProviderState(provider);
    state.authFailed = true;
    state.status = "authentication_failed";
  },
  getCacheSize() {
    return searchCache.size;
  },
  getRunBudgetRemaining() {
    return runBudget.remaining;
  },
  setCacheEntry(
    query: string,
    providers: ProviderName[],
    value: { provider: ProviderName; results: IndexedResult[] },
    ttlMs = DEFAULT_CACHE_TTL_MS
  ) {
    setCached(cacheKey(query, providers), value, ttlMs);
  },
  expireCache(query: string, providers: ProviderName[]) {
    const key = cacheKey(query, providers);
    const entry = searchCache.get(key);
    if (entry) entry.expiresAt = 0;
  },
};
