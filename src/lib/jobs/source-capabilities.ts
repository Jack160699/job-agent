import type { JobSource } from "@prisma/client";
import { publicDiscoveryCapability } from "./public-discovery";

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
  publicDiscoveryStatus?: "available" | "setup_required";
  authenticatedConnectionStatus?: "connected" | "connection_required";
  publicDiscoveryProvider?: string | null;
  importSupported?: boolean;
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
  LINKEDIN: {
    source: "LINKEDIN",
    displayName: "LinkedIn Jobs",
    accessMethod: "Public index discovery or imported job link",
    status: "authentication_required",
    searchable: false,
    explanation:
      "Authenticated LinkedIn features require an approved connection. Public discovery requires a configured search provider.",
    publicDiscoveryStatus: "setup_required",
    authenticatedConnectionStatus: "connection_required",
    publicDiscoveryProvider: null,
    importSupported: true,
  },
  NAUKRI: {
    source: "NAUKRI",
    displayName: "Naukri",
    accessMethod: "Public index discovery or imported job link",
    status: "authentication_required",
    searchable: false,
    explanation:
      "Authenticated Naukri features require an approved connection. Public discovery requires a configured search provider.",
    publicDiscoveryStatus: "setup_required",
    authenticatedConnectionStatus: "connection_required",
    publicDiscoveryProvider: null,
    importSupported: true,
  },
  INDEED: {
    source: "INDEED",
    displayName: "Indeed",
    accessMethod: "Approved feed or direct-link discovery",
    status: "unavailable",
    searchable: false,
    explanation: "No approved production feed is configured.",
  },
  WELLFOUND: {
    source: "WELLFOUND",
    displayName: "Wellfound",
    accessMethod: "Approved feed or direct-link discovery",
    status: "unavailable",
    searchable: false,
    explanation: "No approved production feed is configured.",
  },
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

export function getSourceCapabilities(
  env: Record<string, string | undefined> = process.env
): Record<JobSource, SourceCapability> {
  const discovery = publicDiscoveryCapability(env);
  const capabilities = { ...SOURCE_CAPABILITIES };
  for (const source of ["LINKEDIN", "NAUKRI"] as const) {
    const current = capabilities[source];
    capabilities[source] = {
      ...current,
      status: discovery.available ? "healthy" : "authentication_required",
      searchable: discovery.available,
      publicDiscoveryStatus: discovery.status,
      publicDiscoveryProvider: discovery.provider,
      explanation: discovery.available
        ? `Domain-restricted public discovery is available through ${discovery.provider}. Authenticated platform features still require an approved connection.`
        : "No approved public-search provider is configured. Job-link import remains available; authenticated platform features require an approved connection.",
    };
  }
  return capabilities;
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
