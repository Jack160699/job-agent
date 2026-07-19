import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { JobSource } from "@prisma/client";
import type {
  DiscoveredJob,
  JobSearchFilters,
  JobSourceAdapter,
} from "./types";

const FETCH_TIMEOUT_MS = 15_000;
const RECRUITMENT_RE =
  /\b(recruit(?:ment|ing)?|vacanc(?:y|ies)|career|job opening|employment notice|advt\.?|advertisement|apprentice|trainee|fellow|scientist|engineer|technician|officer|assistant|manager|teacher|nurse|chemist|post(?:s)? of)\b/i;
const EXCLUDED_NOTICE_RE =
  /\b(result|shortlist|interview schedule|admit card|answer key|scorecard|document verification|medical examination|call letter|provisional allotment|provisionally selected|selected candidates|selection list|merit list|fraud|tender)\b/i;
const GENERIC_LINK_RE =
  /^(read more|click here|view|view details|details|apply|apply online|download)$/i;

export interface OfficialGovernmentSourceDefinition {
  source: Extract<
    JobSource,
    | "UPSC"
    | "ISRO"
    | "NTPC"
    | "BEL"
    | "IOCL"
    | "IBPS"
    | "RAILWAYS"
    | "SSC"
    | "DRDO"
    | "RBI"
  >;
  key: string;
  name: string;
  organization: string;
  pageUrl: string;
  allowedHosts: readonly string[];
  searchable: boolean;
  limitation?: string;
  freshnessDaysWhenNoDeadline?: number;
}

export const OFFICIAL_GOVERNMENT_SOURCES: readonly OfficialGovernmentSourceDefinition[] =
  [
    {
      source: "UPSC",
      key: "upsc",
      name: "UPSC recruitment advertisements",
      organization: "Union Public Service Commission",
      pageUrl:
        "https://www.upsc.gov.in/recruitment/recruitment-advertisement",
      allowedHosts: ["upsc.gov.in", "www.upsc.gov.in", "upsconline.nic.in"],
      searchable: true,
    },
    {
      source: "ISRO",
      key: "isro",
      name: "ISRO current opportunities",
      organization: "Indian Space Research Organisation",
      pageUrl: "https://www.isro.gov.in/Careers.html",
      allowedHosts: ["isro.gov.in", "www.isro.gov.in"],
      searchable: true,
    },
    {
      source: "NTPC",
      key: "ntpc",
      name: "NTPC jobs",
      organization: "NTPC Limited",
      pageUrl: "https://ntpc.co.in/index.php/jobs-ntpc",
      allowedHosts: ["ntpc.co.in", "www.ntpc.co.in", "careers.ntpc.co.in"],
      searchable: true,
    },
    {
      source: "BEL",
      key: "bel",
      name: "BEL job notifications",
      organization: "Bharat Electronics Limited",
      pageUrl: "https://bel-india.in/job-notifications/",
      allowedHosts: ["bel-india.in", "www.bel-india.in"],
      searchable: false,
      limitation: "The official page currently presents an invalid TLS certificate chain.",
    },
    {
      source: "IOCL",
      key: "iocl",
      name: "IndianOil latest job openings",
      organization: "Indian Oil Corporation Limited",
      pageUrl: "https://iocl.com/latest-job-opening",
      allowedHosts: ["iocl.com", "www.iocl.com"],
      searchable: false,
      limitation: "The official page currently returns an unusable redirect response.",
    },
    {
      source: "IBPS",
      key: "ibps",
      name: "IBPS recruitments",
      organization: "Institute of Banking Personnel Selection",
      pageUrl: "https://www.ibps.in/",
      allowedHosts: ["ibps.in", "www.ibps.in", "ibpsreg.ibps.in"],
      searchable: false,
      limitation: "The official page currently presents an invalid TLS certificate chain.",
    },
    {
      source: "RAILWAYS",
      key: "railways",
      name: "Railway Recruitment Board notices",
      organization: "Railway Recruitment Board",
      pageUrl: "https://www.rrbcdg.gov.in/",
      allowedHosts: ["rrbcdg.gov.in", "www.rrbcdg.gov.in", "rrbapply.gov.in"],
      searchable: false,
      limitation: "The official page timed out during production verification.",
    },
    {
      source: "SSC",
      key: "ssc",
      name: "SSC recruitment notices",
      organization: "Staff Selection Commission",
      pageUrl: "https://ssc.gov.in/",
      allowedHosts: ["ssc.gov.in", "www.ssc.gov.in"],
      searchable: false,
      limitation:
        "The official page currently returns a client shell without server-readable notices.",
      freshnessDaysWhenNoDeadline: 45,
    },
    {
      source: "DRDO",
      key: "drdo",
      name: "DRDO vacancies",
      organization: "Defence Research and Development Organisation",
      pageUrl: "https://www.drdo.gov.in/drdo/offerings/vacancies?page=0",
      allowedHosts: ["drdo.gov.in", "www.drdo.gov.in"],
      searchable: true,
      freshnessDaysWhenNoDeadline: 45,
    },
    {
      source: "RBI",
      key: "rbi",
      name: "RBI vacancies",
      organization: "Reserve Bank of India",
      pageUrl: "https://opportunities.rbi.org.in/Scripts/Vacancies.aspx",
      allowedHosts: [
        "opportunities.rbi.org.in",
        "www.rbi.org.in",
        "rbi.org.in",
      ],
      searchable: false,
      limitation:
        "The official page currently presents a CAPTCHA challenge to the server adapter; no bypass is used.",
      freshnessDaysWhenNoDeadline: 45,
    },
  ] as const;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parsePublishedDate(value: string): Date | undefined {
  const numeric = value.match(
    /\b([0-3]?\d)[./-]([01]?\d)[./-]((?:19|20)\d{2})\b/
  );
  if (numeric) {
    const date = new Date(
      Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]))
    );
    if (!Number.isNaN(date.getTime())) return date;
  }
  const named = value.match(
    /\b([0-3]?\d)\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+((?:19|20)\d{2})\b/i
  );
  if (named) {
    const date = new Date(`${named[1]} ${named[2]} ${named[3]} UTC`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const namedFirst = value.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\s.]+([0-3]?\d)[,\s]+((?:19|20)\d{2})\b/i
  );
  if (namedFirst) {
    const date = new Date(`${namedFirst[2]} ${namedFirst[1]} ${namedFirst[3]} UTC`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

export function extractGovernmentDeadline(value: string): Date | undefined {
  const deadlineContext = value.match(
    /(?:last date(?: to apply)?|closing date|end date|closes? on|closure of registration|active from[\s\S]{0,80}?\bto)\s*:?\s*([^.;|]{4,40})/i
  )?.[1];
  if (!deadlineContext) return undefined;
  const parsed = parsePublishedDate(deadlineContext);
  if (!parsed) return undefined;
  parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

function extractAdvertisementNumber(value: string): string | undefined {
  return clean(
    value.match(
      /\b(?:advt\.?|advertisement|notification|CEN)\s*(?:no\.?)?\s*[:.-]?\s*([A-Z0-9][A-Z0-9/().:_-]{1,40})/i
    )?.[0] ?? ""
  ) || undefined;
}

function safeOfficialUrl(
  href: string | undefined,
  source: OfficialGovernmentSourceDefinition
): string {
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
    return source.pageUrl;
  }
  try {
    const resolved = new URL(href, source.pageUrl);
    if (!source.allowedHosts.includes(resolved.hostname)) return source.pageUrl;
    if (resolved.protocol === "http:") resolved.protocol = "https:";
    return resolved.protocol === "https:" ? resolved.toString() : source.pageUrl;
  } catch {
    return source.pageUrl;
  }
}

function titleFromContext(anchorText: string, context: string, heading: string): string {
  const candidates = [anchorText, context, heading]
    .map(clean)
    .filter((value) => value && !GENERIC_LINK_RE.test(value));
  const title =
    candidates.find(
      (value) => RECRUITMENT_RE.test(value) && !EXCLUDED_NOTICE_RE.test(value)
    ) ?? "";
  return title.slice(0, 240);
}

export function parseOfficialGovernmentJobs(
  html: string,
  source: OfficialGovernmentSourceDefinition,
  now = new Date()
): DiscoveredJob[] {
  const $ = cheerio.load(html);
  const jobs: DiscoveredJob[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (/archive/i.test(href ?? "") || /\barchives?\b/i.test(anchor.text())) {
      return;
    }
    const anchorText = clean(anchor.text());
    const container = anchor.closest(
      "li, tr, article, section, .views-row, .card, .accordion-item, .job-notification"
    );
    const contextNode = container.length ? container : anchor.parent();
    const context = clean(contextNode.text()).slice(0, 1600);
    const localHeading = clean(
      contextNode.find("h1, h2, h3, h4, h5, h6").first().text()
    );
    const precedingHeading = clean(
      anchor
        .parents()
        .addBack()
        .prevAll("h1, h2, h3, h4, h5, h6")
        .first()
        .text()
    );
    const heading = localHeading || precedingHeading;
    const title = titleFromContext(anchorText, context, heading);
    if (
      !title ||
      !RECRUITMENT_RE.test(`${title} ${context}`) ||
      EXCLUDED_NOTICE_RE.test(title)
    ) {
      return;
    }

    const sourceUrl = safeOfficialUrl(href, source);
    const closesAt = extractGovernmentDeadline(context);
    if (closesAt && closesAt.getTime() < now.getTime()) return;

    const key = `${title.toLowerCase()}|${sourceUrl}`;
    if (seen.has(key)) return;
    seen.add(key);
    const postedContext = context.match(
      /(?:posted on|dated?)\s*:?\s*([^.;|]{4,30})/i
    )?.[1];
    const postedAt = parsePublishedDate(postedContext ?? context);
    if (
      !closesAt &&
      source.freshnessDaysWhenNoDeadline &&
      (!postedAt ||
        now.getTime() - postedAt.getTime() >
          source.freshnessDaysWhenNoDeadline * 24 * 60 * 60 * 1000)
    ) {
      return;
    }
    const currentYear = String(now.getUTCFullYear());
    if (
      !closesAt &&
      !postedAt &&
      !`${title} ${context}`.includes(currentYear)
    ) {
      return;
    }
    const externalId = createHash("sha256").update(key).digest("hex").slice(0, 24);

    jobs.push({
      externalId,
      source: source.source,
      sourceUrl,
      title,
      company: source.organization,
      location: "India",
      description: context || `Official recruitment notice: ${title}`,
      postedAt,
      closesAt,
      metadata: {
        jobType: "government",
        officialSource: source.name,
        officialSourceKey: source.key,
        officialPageUrl: source.pageUrl,
        advertisementNumber: extractAdvertisementNumber(`${title} ${context}`),
        lastVerifiedAt: now.toISOString(),
        verificationStatus: closesAt ? "deadline_checked" : "official_page_unverified_deadline",
      },
    });
  });

  return jobs.slice(0, 80);
}

export class OfficialGovernmentAdapter implements JobSourceAdapter {
  readonly source: OfficialGovernmentSourceDefinition["source"];
  readonly name: string;
  readonly canAutoApply = false;

  constructor(private readonly definition: OfficialGovernmentSourceDefinition) {
    this.source = definition.source;
    this.name = definition.name;
  }

  async search(_filters: JobSearchFilters): Promise<DiscoveredJob[]> {
    void _filters;
    const response = await fetch(this.definition.pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Kairela/1.0 job discovery (https://kairela.com)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Official source returned ${response.status}`);
    }
    const html = await response.text();
    return parseOfficialGovernmentJobs(html, this.definition);
  }

  async getJobDetails(url: string): Promise<DiscoveredJob | null> {
    const job = (await this.search({
      titles: [],
      locations: [],
    })).find((candidate) => candidate.sourceUrl === url);
    return job ?? null;
  }
}

export function getOfficialGovernmentAdapters(): OfficialGovernmentAdapter[] {
  return OFFICIAL_GOVERNMENT_SOURCES.filter(
    (definition) => definition.searchable
  ).map(
    (definition) => new OfficialGovernmentAdapter(definition)
  );
}
