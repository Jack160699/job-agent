import type { DiscoveredJob } from "@/lib/jobs/types";
import type {
  JobFilterResult,
  MatchClassification,
} from "@/lib/jobs/preferences";

export interface FeedbackExample {
  relevant: boolean;
  reason: string | null;
  job: {
    title: string;
    company: string;
    location?: string | null;
    workMode?: string | null;
    employmentType?: string | null;
  };
}

export interface FeedbackProfile {
  titleWeights: Map<string, number>;
  companyWeights: Map<string, number>;
  locationWeights: Map<string, number>;
  workModeWeights: Map<string, number>;
  reasonWeights: Map<string, number>;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function addWeight(map: Map<string, number>, key: string, delta: number) {
  map.set(key, Math.max(-20, Math.min(10, (map.get(key) ?? 0) + delta)));
}

export function buildFeedbackProfile(
  examples: FeedbackExample[]
): FeedbackProfile {
  const titleWeights = new Map<string, number>();
  const companyWeights = new Map<string, number>();
  const locationWeights = new Map<string, number>();
  const workModeWeights = new Map<string, number>();
  const reasonWeights = new Map<string, number>();

  for (const example of examples) {
    const title = normalize(example.job.title);
    const company = normalize(example.job.company);
    const location = normalize(example.job.location ?? "");
    const workMode = normalize(example.job.workMode ?? "");
    if (example.relevant) {
      addWeight(titleWeights, title, 4);
      addWeight(companyWeights, company, 2);
      continue;
    }

    if (example.reason === "wrong_role") addWeight(titleWeights, title, -15);
    if (example.reason === "wrong_seniority") addWeight(titleWeights, title, -10);
    if (example.reason === "wrong_salary") addWeight(titleWeights, title, -4);
    if (example.reason === "wrong_location" && location) {
      addWeight(locationWeights, location, -15);
    }
    if (example.reason === "wrong_work_mode" && workMode) {
      addWeight(workModeWeights, workMode, -15);
    }
    if (example.reason === "wrong_industry") addWeight(titleWeights, title, -6);
    if (example.reason === "company_not_preferred") {
      addWeight(companyWeights, company, -15);
    }
    if (example.reason) addWeight(reasonWeights, example.reason, -4);
    if (
      example.reason === "not_interested" ||
      example.reason === "misleading_posting"
    ) {
      addWeight(
        companyWeights,
        company,
        example.reason === "misleading_posting" ? -20 : -5
      );
    }
  }

  return {
    titleWeights,
    companyWeights,
    locationWeights,
    workModeWeights,
    reasonWeights,
  };
}

function classification(score: number): MatchClassification {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "POSSIBLE";
  return "LOW";
}

export function applyFeedbackProfile(
  result: JobFilterResult,
  job: DiscoveredJob,
  profile: FeedbackProfile,
  threshold: number
): JobFilterResult {
  if (!result.accepted) return result;
  const titleDelta = profile.titleWeights.get(normalize(job.title)) ?? 0;
  const companyDelta = profile.companyWeights.get(normalize(job.company)) ?? 0;
  const locationDelta =
    profile.locationWeights.get(normalize(job.location ?? "")) ?? 0;
  const workModeDelta =
    profile.workModeWeights.get(normalize(job.workMode ?? "")) ?? 0;
  const delta = titleDelta + companyDelta + locationDelta + workModeDelta;
  if (delta === 0) return result;

  const score = Math.max(0, Math.min(100, result.score + delta));
  const accepted = score >= threshold;
  const keepPotential =
    result.classification === "POTENTIAL_MATCH_REQUIRES_VERIFICATION" &&
    accepted;
  return {
    ...result,
    score,
    accepted,
    classification: !accepted
      ? "REJECTED"
      : keepPotential
        ? "POTENTIAL_MATCH_REQUIRES_VERIFICATION"
        : classification(score),
    reasons:
      delta > 0
        ? [...result.reasons, "Adjusted using your prior match feedback"]
        : result.reasons,
    exclusions:
      !accepted && delta < 0
        ? [...result.exclusions, "Similar roles were marked not relevant"]
        : result.exclusions,
    concerns:
      delta < 0
        ? [...result.concerns, "Ranked lower using your prior match feedback"]
        : result.concerns,
    recommendation: accepted
      ? result.recommendation
      : "Excluded after applying your prior match feedback",
  };
}
