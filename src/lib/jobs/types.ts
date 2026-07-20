import type {
  EmploymentType,
  JobSource,
  WorkMode,
} from "@prisma/client";

export interface DiscoveredJob {
  externalId?: string;
  source: JobSource;
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  industry?: string;
  visaSponsorship?: boolean | null;
  postedAt?: Date;
  closesAt?: Date;
  removedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface JobSearchFilters {
  titles: string[];
  queries?: Array<{
    title: string;
    location: string | null;
    remoteScope: "INDIA" | "WORLDWIDE" | null;
    stage?: "strict" | "balanced" | "recovery";
    reasons: string[];
  }>;
  locations: string[];
  remote?: boolean;
  experienceYears?: number;
  skills?: string[];
  discoveryBoards?: {
    greenhouse?: string[];
    lever?: string[];
    ashby?: string[];
    workday?: string[];
  };
}

export interface JobSourceAdapter {
  source: JobSource;
  name: string;
  search(filters: JobSearchFilters): Promise<DiscoveredJob[]>;
  getJobDetails(url: string): Promise<DiscoveredJob | null>;
  canAutoApply: boolean;
}

export const JOB_SOURCES: Record<JobSource, { name: string; canAutoApply: boolean }> = {
  LINKEDIN: { name: "LinkedIn", canAutoApply: false },
  WELLFOUND: { name: "Wellfound", canAutoApply: false },
  NAUKRI: { name: "Naukri", canAutoApply: false },
  INDEED: { name: "Indeed", canAutoApply: false },
  FOUNDIT: { name: "Foundit", canAutoApply: false },
  SHINE: { name: "Shine", canAutoApply: false },
  TIMESJOBS: { name: "TimesJobs", canAutoApply: false },
  CUTSHORT: { name: "Cutshort", canAutoApply: false },
  INSTAHYRE: { name: "Instahyre", canAutoApply: false },
  INTERNSHALA: { name: "Internshala", canAutoApply: false },
  APNA: { name: "Apna", canAutoApply: false },
  FRESHERSWORLD: { name: "Freshersworld", canAutoApply: false },
  HIRIST: { name: "Hirist", canAutoApply: false },
  IIMJOBS: { name: "iimjobs", canAutoApply: false },
  GREENHOUSE: { name: "Greenhouse", canAutoApply: true },
  LEVER: { name: "Lever", canAutoApply: true },
  ASHBY: { name: "Ashby", canAutoApply: true },
  WORKDAY: { name: "Workday", canAutoApply: true },
  UPSC: { name: "UPSC", canAutoApply: false },
  ISRO: { name: "ISRO", canAutoApply: false },
  NTPC: { name: "NTPC", canAutoApply: false },
  BEL: { name: "BEL", canAutoApply: false },
  IOCL: { name: "IndianOil", canAutoApply: false },
  IBPS: { name: "IBPS", canAutoApply: false },
  RAILWAYS: { name: "Railway Recruitment Board", canAutoApply: false },
  SSC: { name: "Staff Selection Commission", canAutoApply: false },
  DRDO: { name: "DRDO", canAutoApply: false },
  RBI: { name: "Reserve Bank of India", canAutoApply: false },
  COMPANY_PORTAL: { name: "Company Portal", canAutoApply: false },
  OTHER: { name: "Other", canAutoApply: false },
};

export function detectJobSource(url: string): JobSource {
  if (url.includes("linkedin.com")) return "LINKEDIN";
  if (url.includes("wellfound.com") || url.includes("angel.co")) return "WELLFOUND";
  if (url.includes("naukri.com")) return "NAUKRI";
  if (url.includes("indeed.com")) return "INDEED";
  if (url.includes("foundit.in")) return "FOUNDIT";
  if (url.includes("shine.com")) return "SHINE";
  if (url.includes("timesjobs.com")) return "TIMESJOBS";
  if (url.includes("cutshort.io")) return "CUTSHORT";
  if (url.includes("instahyre.com")) return "INSTAHYRE";
  if (url.includes("internshala.com")) return "INTERNSHALA";
  if (url.includes("apna.co")) return "APNA";
  if (url.includes("freshersworld.com")) return "FRESHERSWORLD";
  if (url.includes("hirist.tech") || url.includes("hirist.com")) return "HIRIST";
  if (url.includes("iimjobs.com")) return "IIMJOBS";
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse.io")) return "GREENHOUSE";
  if (url.includes("lever.co") || url.includes("jobs.lever.co")) return "LEVER";
  if (url.includes("ashbyhq.com") || url.includes("jobs.ashbyhq.com")) return "ASHBY";
  if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return "WORKDAY";
  if (url.includes("upsc.gov.in") || url.includes("upsconline.nic.in")) return "UPSC";
  if (url.includes("isro.gov.in")) return "ISRO";
  if (url.includes("ntpc.co.in")) return "NTPC";
  if (url.includes("bel-india.in")) return "BEL";
  if (url.includes("iocl.com")) return "IOCL";
  if (url.includes("ibps.in")) return "IBPS";
  if (url.includes("rrbcdg.gov.in") || url.includes("rrbapply.gov.in")) return "RAILWAYS";
  if (url.includes("ssc.gov.in")) return "SSC";
  if (url.includes("drdo.gov.in")) return "DRDO";
  if (url.includes("opportunities.rbi.org.in") || url.includes("rbi.org.in")) return "RBI";
  return "COMPANY_PORTAL";
}
