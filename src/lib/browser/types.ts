export interface BrowserSnapshot {
  url: string;
  title: string;
  elements: BrowserElement[];
}

export interface BrowserElement {
  ref: string;
  role: string;
  name: string;
  tag?: string;
  type?: string;
  value?: string;
}

export interface FillField {
  label?: string;
  name?: string;
  ref?: string;
  value: string;
}

export interface ApplicationDocuments {
  resumePdf?: Buffer;
  resumeText?: string;
  coverLetterText?: string;
  coverLetterPdf?: Buffer;
}

export interface ApplicationProfile {
  fullName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  /** Grounded preferences only — never invent missing facts during automation. */
  experienceYears?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  visaSponsorshipRequired?: boolean | null;
  willingToRelocate?: boolean | null;
  noticePeriodDays?: number | null;
  workModes?: Array<"REMOTE" | "HYBRID" | "ONSITE"> | null;
}

export interface SubmissionResult {
  success: boolean;
  status: "submitted" | "pending_review" | "failed" | "requires_manual";
  message: string;
  screenshotPath?: string;
  formData?: Record<string, unknown>;
}

export interface BrowserAutomationClient {
  navigate(url: string): Promise<void>;
  snapshot(): Promise<BrowserSnapshot>;
  click(ref: string): Promise<void>;
  fill(fields: FillField[]): Promise<void>;
  type(ref: string, text: string): Promise<void>;
  select(ref: string, value: string): Promise<void>;
  upload(ref: string, filePath: string): Promise<void>;
  waitForSelector(selector: string, timeoutMs?: number): Promise<void>;
  screenshot(): Promise<Buffer>;
  close(): Promise<void>;
}
