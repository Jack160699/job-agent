import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import type { AtsReadinessScore } from "@/lib/resumes/ats-score";

export interface MasterResumeUploadResult {
  id: string;
  title: string;
  version: number;
  profile: ParsedCareerProfile;
  atsScore: AtsReadinessScore;
  enrichmentPending: boolean;
}

export type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

export const ACCEPTED_RESUME_EXTENSIONS = ["pdf", "docx", "txt"] as const;
export const ACCEPTED_RESUME_ACCEPT_ATTR =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
