import type { JobSource } from "@prisma/client";
import {
  PUBLIC_DISCOVERY_SOURCES,
  publicDiscoveryCapability,
  type ProviderHealthSnapshot,
} from "./public-discovery";

export type SourceCapabilityStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "rate_limited"
  | "authentication_required"
  | "misconfigured"
  | "blocked"
  | "no_results"
  | "stale";

export interface SourceCapability {
  source: JobSource;
  displayName: string;
  accessMethod: string;
  status: SourceCapabilityStatus;
  searchable: boolean;
  explanation: string;
  publicDiscoveryStatus?: "available" | "setup_required" | "unavailable";
  authenticatedConnectionStatus?: "connected" | "connection_required";
  publicDiscoveryProvider?: string | null;
  publicDiscoveryProviderStatus?: string | null;
  importSupported?: boolean;
  noEasyApplyClaim?: boolean;
}

function publicSource(
  source: JobSource,
  displayName: string,
  options: { connection?: boolean; importSupported?: boolean } = {}
): SourceCapability {
  return {
    source,
    displayName,
    accessMethod: "Domain-restricted public index discovery",
    status: options.connection ? "authentication_required" : "misconfigured",
    searchable: false,
    explanation:
      "No approved public-search provider is configured. Individual job-link import remains available where supported.",
    publicDiscoveryStatus: "setup_required",
    authenticatedConnectionStatus: options.connection
      ? "connection_required"
      : undefined,
    publicDiscoveryProvider: null,
    importSupported: options.importSupported ?? true,
  };
}

export const SOURCE_CAPABILITIES: Record<JobSource, SourceCapability> = {
  GREENHOUSE: {
    source: "GREENHOUSE",
    displayName: "Greenhouse public boards",
    accessMethod: "Public job-board API",
    status: "healthy",
    searchable: true,
    explanation: "Searches configured public employer boards.",
  },
  LEVER: {
    source: "LEVER",
    displayName: "Lever public postings",
    accessMethod: "Public postings API",
    status: "healthy",
    searchable: true,
    explanation: "Searches configured public employer pages.",
  },
  ASHBY: {
    source: "ASHBY",
    displayName: "Ashby public boards",
    accessMethod: "Public job-board API",
    status: "healthy",
    searchable: true,
    explanation: "Searches configured public employer boards.",
  },
  WORKDAY: {
    source: "WORKDAY",
    displayName: "Workday public career pages",
    accessMethod: "Public career-site API",
    status: "healthy",
    searchable: true,
    explanation: "Searches configured public Workday tenants.",
  },
  UPSC: {
    source: "UPSC",
    displayName: "UPSC recruitment advertisements",
    accessMethod: "Official public recruitment page",
    status: "healthy",
    searchable: true,
    explanation: "Indexes official UPSC recruitment advertisements.",
  },
  ISRO: {
    source: "ISRO",
    displayName: "ISRO current opportunities",
    accessMethod: "Official public careers page",
    status: "healthy",
    searchable: true,
    explanation: "Indexes official ISRO current-opportunity notices.",
  },
  NTPC: {
    source: "NTPC",
    displayName: "NTPC jobs",
    accessMethod: "Official public jobs page",
    status: "healthy",
    searchable: true,
    explanation: "Indexes official NTPC recruitment notices.",
  },
  BEL: {
    source: "BEL",
    displayName: "BEL job notifications",
    accessMethod: "Official public job-notifications page",
    status: "unavailable",
    searchable: false,
    explanation:
      "The official page currently fails TLS certificate validation; no unsafe bypass is used.",
  },
  IOCL: {
    source: "IOCL",
    displayName: "IndianOil latest openings",
    accessMethod: "Official public careers page",
    status: "blocked",
    searchable: false,
    explanation:
      "The official page currently returns an unusable redirect response.",
  },
  IBPS: {
    source: "IBPS",
    displayName: "IBPS recruitments",
    accessMethod: "Official public recruitment pages",
    status: "unavailable",
    searchable: false,
    explanation:
      "The official page currently fails TLS certificate validation; no unsafe bypass is used.",
  },
  RAILWAYS: {
    source: "RAILWAYS",
    displayName: "Railway Recruitment Board",
    accessMethod: "Official public employment-notice page",
    status: "degraded",
    searchable: false,
    explanation:
      "The official page timed out during verification; retry when it is reachable.",
  },
  SSC: {
    source: "SSC",
    displayName: "SSC recruitment notices",
    accessMethod: "Official public commission page",
    status: "degraded",
    searchable: false,
    explanation:
      "The official page currently returns a client shell without server-readable notices.",
  },
  DRDO: {
    source: "DRDO",
    displayName: "DRDO vacancies",
    accessMethod: "Official public vacancies page",
    status: "healthy",
    searchable: true,
    explanation: "Indexes recent official DRDO vacancy notices.",
  },
  RBI: {
    source: "RBI",
    displayName: "RBI vacancies",
    accessMethod: "Official public vacancies page",
    status: "blocked",
    searchable: false,
    explanation:
      "The official page presents a CAPTCHA challenge to the server adapter; no bypass is used.",
  },
  LINKEDIN: publicSource("LINKEDIN", "LinkedIn Jobs", {
    connection: true,
  }),
  NAUKRI: publicSource("NAUKRI", "Naukri", { connection: true }),
  INDEED: publicSource("INDEED", "Indeed India"),
  WELLFOUND: publicSource("WELLFOUND", "Wellfound"),
  FOUNDIT: publicSource("FOUNDIT", "Foundit India"),
  SHINE: publicSource("SHINE", "Shine"),
  TIMESJOBS: publicSource("TIMESJOBS", "TimesJobs"),
  CUTSHORT: publicSource("CUTSHORT", "Cutshort"),
  INSTAHYRE: publicSource("INSTAHYRE", "Instahyre"),
  INTERNSHALA: publicSource("INTERNSHALA", "Internshala"),
  APNA: publicSource("APNA", "Apna"),
  FRESHERSWORLD: publicSource("FRESHERSWORLD", "Freshersworld"),
  HIRIST: publicSource("HIRIST", "Hirist"),
  IIMJOBS: publicSource("IIMJOBS", "iimjobs"),
  COMPANY_PORTAL: {
    source: "COMPANY_PORTAL",
    displayName: "Company career pages",
    accessMethod: "Configured public employer pages",
    status: "misconfigured",
    searchable: false,
    explanation:
      "Add a supported public Greenhouse, Lever, Ashby, or Workday employer page.",
  },
  OTHER: {
    source: "OTHER",
    displayName: "Other sources",
    accessMethod: "Source-specific permitted integration",
    status: "unavailable",
    searchable: false,
    explanation: "No production adapter is configured.",
  },
};

function providerStatusLabel(health: ProviderHealthSnapshot | null | undefined) {
  if (!health?.configured) return "not configured";
  switch (health.status) {
    case "healthy":
      return "healthy";
    case "authentication_failed":
      return "authentication failed";
    case "rate_limited":
      return "rate limited";
    case "quota_exhausted":
      return "quota exhausted";
    case "temporarily_unavailable":
      return "temporarily unavailable";
    default:
      return "configured";
  }
}

export function getSourceCapabilities(
  env: Record<string, string | undefined> = process.env
): Record<JobSource, SourceCapability> {
  const discovery = publicDiscoveryCapability(env);
  const capabilities = { ...SOURCE_CAPABILITIES };
  const primaryHealth = discovery.primaryHealth;
  const publicAvailable = discovery.available;
  const publicStatusLabel = providerStatusLabel(primaryHealth);

  for (const source of PUBLIC_DISCOVERY_SOURCES) {
    const current = capabilities[source];
    const connectionRequired = source === "LINKEDIN" || source === "NAUKRI";
    capabilities[source] = {
      ...current,
      status: publicAvailable
        ? primaryHealth?.status === "quota_exhausted" ||
          primaryHealth?.status === "rate_limited"
          ? "rate_limited"
          : "healthy"
        : connectionRequired
          ? "authentication_required"
          : "misconfigured",
      searchable: publicAvailable,
      publicDiscoveryStatus: publicAvailable
        ? "available"
        : discovery.serper?.status === "authentication_failed"
          ? "unavailable"
          : "setup_required",
      publicDiscoveryProvider: discovery.provider,
      publicDiscoveryProviderStatus: publicStatusLabel,
      noEasyApplyClaim: true,
      explanation: publicAvailable
        ? `Public discovery available via ${discovery.providers.join(
            ", "
          )} (${publicStatusLabel}). Only public index metadata and validated individual job URLs are stored. Authenticated platform features and Easy Apply are not claimed.`
        : connectionRequired
          ? "Public discovery unavailable. Job-link import remains available; authenticated platform features require an approved connection. Easy Apply is not claimed."
          : "Public discovery unavailable. Individual job-link import remains available where supported.",
    };
  }
  return capabilities;
}

export function getPublicProviderDiagnostics(
  env: Record<string, string | undefined> = process.env
) {
  return publicDiscoveryCapability(env);
}

export function unavailableEnabledSources(
  enabled: JobSource[],
  searchable: JobSource[]
): SourceCapability[] {
  const searchableSet = new Set(searchable);
  return enabled
    .filter((source) => !searchableSet.has(source))
    .map((source) => SOURCE_CAPABILITIES[source]);
}
