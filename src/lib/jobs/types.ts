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
  GREENHOUSE: { name: "Greenhouse", canAutoApply: true },
  LEVER: { name: "Lever", canAutoApply: true },
  ASHBY: { name: "Ashby", canAutoApply: true },
  WORKDAY: { name: "Workday", canAutoApply: true },
  COMPANY_PORTAL: { name: "Company Portal", canAutoApply: false },
  OTHER: { name: "Other", canAutoApply: false },
};

export function detectJobSource(url: string): JobSource {
  if (url.includes("linkedin.com")) return "LINKEDIN";
  if (url.includes("wellfound.com") || url.includes("angel.co")) return "WELLFOUND";
  if (url.includes("naukri.com")) return "NAUKRI";
  if (url.includes("indeed.com")) return "INDEED";
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse.io")) return "GREENHOUSE";
  if (url.includes("lever.co") || url.includes("jobs.lever.co")) return "LEVER";
  if (url.includes("ashbyhq.com") || url.includes("jobs.ashbyhq.com")) return "ASHBY";
  if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return "WORKDAY";
  return "COMPANY_PORTAL";
}
