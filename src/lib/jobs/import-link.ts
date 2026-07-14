import { createHash } from "crypto";
import type { LookupAddress } from "dns";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { load } from "cheerio";
import type {
  EmploymentType,
  JobSource,
  Prisma,
  WorkMode,
} from "@prisma/client";
import prisma from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { analyzeJob, matchJob } from "@/lib/jobs/pipeline";

const MAX_REDIRECTS = 3;
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const EXTRACTOR_VERSION = "v1";
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "ref",
  "refid",
  "source",
  "trk",
  "trackingid",
]);

export class JobImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "JobImportError";
  }
}

export interface ManualJobInput {
  title: string;
  company: string;
  description: string;
  location?: string;
  applicationUrl?: string;
}

export interface ExtractedJob {
  title: string;
  company: string;
  location?: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceMin?: number;
  experienceMax?: number;
  skills: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description: string;
  applicationUrl: string;
  source: JobSource;
  ats?: string;
  postedAt?: Date;
  extractionMethod: "json_ld" | "html" | "manual";
}

function cleanText(value: unknown, max = 100_000): string {
  if (typeof value !== "string") return "";
  const $ = load(`<body>${value}</body>`);
  $("script,style,noscript,iframe,object,embed,form").remove();
  return $("body")
    .text()
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function detectSource(url: URL): JobSource {
  const host = url.hostname.toLowerCase();
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "LINKEDIN";
  if (host === "wellfound.com" || host.endsWith(".wellfound.com") || host === "angel.co") {
    return "WELLFOUND";
  }
  if (host === "naukri.com" || host.endsWith(".naukri.com")) return "NAUKRI";
  if (host === "indeed.com" || host.endsWith(".indeed.com")) return "INDEED";
  if (host.endsWith("greenhouse.io") || host === "greenhouse.io") return "GREENHOUSE";
  if (host.endsWith("lever.co") || host === "lever.co") return "LEVER";
  if (host.endsWith("ashbyhq.com") || host === "ashbyhq.com") return "ASHBY";
  if (host.endsWith("myworkdayjobs.com") || host.endsWith("workday.com")) return "WORKDAY";
  return "COMPANY_PORTAL";
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice(7));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

export function normalizeJobUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new JobImportError("INVALID_URL", "Enter a complete public job URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new JobImportError("UNSUPPORTED_PROTOCOL", "Only public HTTP and HTTPS job links are supported.");
  }
  if (url.username || url.password) {
    throw new JobImportError("URL_CREDENTIALS", "Links containing embedded credentials are not allowed.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new JobImportError("UNSAFE_PORT", "The job link uses a network port that is not allowed.");
  }

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  return url;
}

async function assertPublicDestination(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new JobImportError("PRIVATE_DESTINATION", "Private and local network addresses are not allowed.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new JobImportError("PRIVATE_DESTINATION", "Private and local network addresses are not allowed.");
    }
    return;
  }

  let addresses: LookupAddress[];
  try {
    addresses = (await lookup(hostname, { all: true, verbatim: true })) as LookupAddress[];
  } catch {
    throw new JobImportError("DNS_LOOKUP_FAILED", "The job site could not be found.", true);
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new JobImportError("PRIVATE_DESTINATION", "The link resolves to a private network address.");
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_CONTENT_BYTES) {
    throw new JobImportError("CONTENT_TOO_LARGE", "The job page is too large to import safely.");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CONTENT_BYTES) {
      await reader.cancel();
      throw new JobImportError("CONTENT_TOO_LARGE", "The job page is too large to import safely.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function fetchPublicJobPage(initialUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    await assertPublicDestination(currentUrl);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml,application/ld+json;q=0.9",
          "User-Agent": "KairelaJobImporter/1.0 (+https://kairela.com)",
        },
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new JobImportError(
        timedOut ? "FETCH_TIMEOUT" : "FETCH_FAILED",
        timedOut
          ? "The job site took too long to respond."
          : "Kairela could not reach this public job page.",
        true
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new JobImportError("INVALID_REDIRECT", "The job site returned an invalid redirect.");
      if (redirect === MAX_REDIRECTS) {
        throw new JobImportError("TOO_MANY_REDIRECTS", "The job link redirected too many times.");
      }
      currentUrl = normalizeJobUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if ([401, 403, 407, 429].includes(response.status)) {
      throw new JobImportError(
        "PAGE_BLOCKED",
        "This job site requires login or blocked automated access. Paste the job description to continue."
      );
    }
    if (!response.ok) {
      throw new JobImportError(
        "HTTP_ERROR",
        `The job site returned HTTP ${response.status}. Paste the description if the page works in your browser.`,
        response.status >= 500
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("application/ld+json")
    ) {
      throw new JobImportError("UNSUPPORTED_CONTENT", "The link does not point to a supported public job page.");
    }

    return { html: await readLimitedBody(response), finalUrl: currentUrl };
  }

  throw new JobImportError("FETCH_FAILED", "The public job page could not be loaded.");
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findJobPosting(entry);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const type = object["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return object;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findJobPosting(object[key]);
    if (found) return found;
  }
  return null;
}

function readAddress(posting: Record<string, unknown>): string | undefined {
  const locations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : posting.jobLocation
      ? [posting.jobLocation]
      : [];
  const first = locations[0] as Record<string, unknown> | undefined;
  const address = first?.address as Record<string, unknown> | undefined;
  const values = [
    address?.addressLocality,
    address?.addressRegion,
    address?.addressCountry,
  ].filter((value): value is string => typeof value === "string" && Boolean(value));
  return values.length ? values.join(", ") : undefined;
}

function normalizeEmploymentType(value: unknown): EmploymentType {
  const text = Array.isArray(value) ? value.join(" ") : String(value || "");
  if (/part/i.test(text)) return "PART_TIME";
  if (/contract|temporary/i.test(text)) return "CONTRACT";
  if (/intern/i.test(text)) return "INTERNSHIP";
  if (/freelance/i.test(text)) return "FREELANCE";
  return /full|permanent/i.test(text) ? "FULL_TIME" : "UNKNOWN";
}

function parseSalary(posting: Record<string, unknown>) {
  const salary = posting.baseSalary as Record<string, unknown> | undefined;
  const value = salary?.value as Record<string, unknown> | undefined;
  const min = Number(value?.minValue ?? value?.value);
  const max = Number(value?.maxValue ?? value?.value);
  return {
    salaryMin: Number.isFinite(min) ? Math.round(min) : undefined,
    salaryMax: Number.isFinite(max) ? Math.round(max) : undefined,
    salaryCurrency:
      typeof salary?.currency === "string" ? salary.currency.toUpperCase().slice(0, 3) : undefined,
  };
}

export function extractFromHtml(html: string, url: URL): ExtractedJob {
  const $ = load(html);
  $("script:not([type='application/ld+json']),style,noscript,iframe,object,embed,form").remove();

  let posting: Record<string, unknown> | null = null;
  $("script[type='application/ld+json']").each((_, element) => {
    if (posting) return;
    try {
      posting = findJobPosting(JSON.parse($(element).text()));
    } catch {
      // Invalid third-party JSON-LD is ignored.
    }
  });

  const source = detectSource(url);
  const jsonLd = posting;
  const hiringOrganization = jsonLd?.["hiringOrganization"] as Record<string, unknown> | undefined;
  const title =
    cleanText(jsonLd?.["title"], 300) ||
    cleanText($("meta[property='og:title']").attr("content"), 300) ||
    cleanText($("h1").first().text(), 300);
  const company =
    cleanText(hiringOrganization?.name, 300) ||
    cleanText($("meta[property='og:site_name']").attr("content"), 300) ||
    cleanText(
      $("[data-automation-id='company'],[class*='company-name'],[class*='companyName']")
        .first()
        .text(),
      300
    );
  const description =
    cleanText(jsonLd?.["description"]) ||
    cleanText(
      $("[data-automation-id='jobPostingDescription'],[class*='job-description'],[class*='description']")
        .first()
        .html()
    ) ||
    cleanText($("main").text());

  if (!title || !company || description.length < 80) {
    throw new JobImportError(
      "EXTRACTION_INCOMPLETE",
      "Kairela reached the page but could not verify the role, company, and description. Paste the description to continue."
    );
  }

  const location = jsonLd ? readAddress(jsonLd) : undefined;
  const jobLocationType = String(jsonLd?.["jobLocationType"] || "");
  const remote = /telecommute|remote/i.test(jobLocationType) || /\bremote\b/i.test(location || "");
  const skillsValue = jsonLd?.["skills"] ?? jsonLd?.["qualifications"];
  const skills = cleanText(skillsValue, 2_000)
    .split(/[,;|•]/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1 && skill.length < 80)
    .slice(0, 30);
  const postedAt =
    typeof jsonLd?.["datePosted"] === "string" &&
    !Number.isNaN(Date.parse(jsonLd["datePosted"] as string))
      ? new Date(jsonLd["datePosted"] as string)
      : undefined;

  return {
    title,
    company,
    location,
    workMode: remote ? "REMOTE" : "UNKNOWN",
    employmentType: normalizeEmploymentType(jsonLd?.["employmentType"]),
    skills,
    ...parseSalary(jsonLd || {}),
    description,
    applicationUrl: url.toString(),
    source,
    ats: source === "COMPANY_PORTAL" ? undefined : source,
    postedAt,
    extractionMethod: jsonLd ? "json_ld" : "html",
  };
}

function extractionFromManual(url: URL, manual: ManualJobInput): ExtractedJob {
  const title = cleanText(manual.title, 300);
  const company = cleanText(manual.company, 300);
  const description = cleanText(manual.description);
  if (!title || !company || description.length < 80) {
    throw new JobImportError(
      "MANUAL_DETAILS_INCOMPLETE",
      "Add the role, company, and at least 80 characters of the job description."
    );
  }
  return {
    title,
    company,
    description,
    location: cleanText(manual.location, 300) || undefined,
    workMode: /\bremote\b/i.test(manual.location || "") ? "REMOTE" : "UNKNOWN",
    employmentType: "UNKNOWN",
    skills: [],
    applicationUrl: manual.applicationUrl
      ? normalizeJobUrl(manual.applicationUrl).toString()
      : url.toString(),
    source: detectSource(url),
    ats: detectSource(url) === "COMPANY_PORTAL" ? undefined : detectSource(url),
    extractionMethod: "manual",
  };
}

async function persistExtractedJob(userId: string, urlHash: string, extracted: ExtractedJob) {
  const externalId = `import:${urlHash}`;
  const job = await prisma.job.upsert({
    where: {
      userId_source_externalId: {
        userId,
        source: extracted.source,
        externalId,
      },
    },
    update: {
      sourceUrl: extracted.applicationUrl,
      title: extracted.title,
      company: extracted.company,
      location: extracted.location,
      workMode: extracted.workMode,
      employmentType: extracted.employmentType,
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency,
      description: extracted.description,
      requiredSkills: extracted.skills,
      postedAt: extracted.postedAt,
      status: "ACTIVE",
      metadata: {
        provenance: "job_link_import",
        importedAt: new Date().toISOString(),
        extractionMethod: extracted.extractionMethod,
        ats: extracted.ats,
        extractorVersion: EXTRACTOR_VERSION,
      } satisfies Prisma.InputJsonValue,
    },
    create: {
      userId,
      externalId,
      source: extracted.source,
      sourceUrl: extracted.applicationUrl,
      title: extracted.title,
      company: extracted.company,
      location: extracted.location,
      workMode: extracted.workMode,
      employmentType: extracted.employmentType,
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency,
      description: extracted.description,
      requiredSkills: extracted.skills,
      preferredSkills: [],
      postedAt: extracted.postedAt,
      metadata: {
        provenance: "job_link_import",
        importedAt: new Date().toISOString(),
        extractionMethod: extracted.extractionMethod,
        ats: extracted.ats,
        extractorVersion: EXTRACTOR_VERSION,
      } satisfies Prisma.InputJsonValue,
    },
  });

  const application = await prisma.application.upsert({
    where: { userId_jobId: { userId, jobId: job.id } },
    update: {},
    create: {
      userId,
      jobId: job.id,
      status: "DISCOVERED",
      requiresReview: true,
      autoSubmit: false,
    },
  });

  return { job, application };
}

async function enrichImportedJob(userId: string, jobId: string) {
  let analysisError: string | undefined;
  try {
    await analyzeJob(userId, jobId);
    await matchJob(userId, jobId);
  } catch (error) {
    analysisError = error instanceof Error ? error.message : "Match analysis is temporarily unavailable";
  }
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  return { job, analysisError };
}

export async function importJobLink(
  userId: string,
  input: { url: string; manual?: ManualJobInput }
) {
  const normalizedUrl = normalizeJobUrl(input.url);
  const normalized = normalizedUrl.toString();
  const urlHash = createHash("sha256").update(normalized).digest("hex");
  const source = detectSource(normalizedUrl);
  const existing = await prisma.jobImport.findUnique({
    where: { userId_urlHash: { userId, urlHash } },
    include: { job: true },
  });

  if (existing?.status === "completed" && existing.job && !input.manual) {
    return {
      duplicate: true,
      import: existing,
      job: existing.job,
      analysisError: undefined,
    };
  }

  const importRecord = await prisma.jobImport.upsert({
    where: { userId_urlHash: { userId, urlHash } },
    update: {
      status: "extracting",
      errorCode: null,
      errorMessage: null,
      attempts: { increment: 1 },
      manualDescription: input.manual?.description,
    },
    create: {
      userId,
      normalizedUrl: normalized,
      urlHash,
      source,
      status: "extracting",
      manualDescription: input.manual?.description,
    },
  });

  try {
    const extracted = input.manual
      ? extractionFromManual(normalizedUrl, input.manual)
      : (() => null as ExtractedJob | null)();
    let resolved = extracted;
    if (!resolved) {
      const fetched = await fetchPublicJobPage(normalizedUrl);
      resolved = extractFromHtml(fetched.html, fetched.finalUrl);
    }

    const { job, application } = await persistExtractedJob(userId, urlHash, resolved);
    await prisma.jobImport.update({
      where: { id: importRecord.id },
      data: {
        jobId: job.id,
        source: resolved.source,
        status: "completed",
        extractionMethod: resolved.extractionMethod,
        extractedData: resolved as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        correctedAt: input.manual ? new Date() : undefined,
      },
    });

    const enriched = await enrichImportedJob(userId, job.id);
    await createAuditLog({
      userId,
      action: "JOB_LINK_IMPORTED",
      resource: "job",
      resourceId: job.id,
      message: `Imported ${resolved.title} at ${resolved.company}`,
      metadata: {
        source: resolved.source,
        extractionMethod: resolved.extractionMethod,
        duplicate: Boolean(existing),
      },
    });

    return {
      duplicate: Boolean(existing),
      import: { ...importRecord, status: "completed", jobId: job.id },
      job: enriched.job || job,
      application,
      analysisError: enriched.analysisError,
    };
  } catch (error) {
    const importError =
      error instanceof JobImportError
        ? error
        : new JobImportError("EXTRACTION_FAILED", "Kairela could not extract this job page.", true);
    await prisma.jobImport.update({
      where: { id: importRecord.id },
      data: {
        status: importError.code === "PAGE_BLOCKED" ? "blocked" : "failed",
        errorCode: importError.code,
        errorMessage: importError.message,
      },
    });
    await createAuditLog({
      userId,
      level: "WARN",
      action: "JOB_LINK_IMPORT_FAILED",
      resource: "job_import",
      resourceId: importRecord.id,
      message: importError.message,
      metadata: { code: importError.code, source, retryable: importError.retryable },
    });
    throw importError;
  }
}
