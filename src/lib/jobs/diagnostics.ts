export type FilterImpactCategory =
  | "title_mismatch"
  | "profession_mismatch"
  | "location_mismatch"
  | "salary_below_minimum"
  | "experience_mismatch"
  | "seniority_mismatch"
  | "work_mode_mismatch"
  | "missing_skills"
  | "qualification_mismatch"
  | "excluded_keyword"
  | "excluded_company"
  | "employment_type_mismatch"
  | "industry_mismatch"
  | "expired_or_removed"
  | "stale_posting"
  | "sponsorship_unavailable"
  | "below_match_threshold"
  | "insufficient_information"
  | "insufficient_metadata"
  | "low_confidence_public_snippet"
  | "other";

export const FILTER_IMPACT_LABELS: Record<FilterImpactCategory, string> = {
  title_mismatch: "Job title did not match your target roles",
  profession_mismatch: "Profession did not match your target field",
  location_mismatch: "Outside your preferred locations",
  salary_below_minimum: "Salary below your minimum",
  experience_mismatch: "Experience requirement did not fit",
  seniority_mismatch: "Seniority level did not fit",
  work_mode_mismatch: "Work mode did not match",
  missing_skills: "None of your listed skills appeared in the posting",
  qualification_mismatch: "Required qualification was not confirmed",
  excluded_keyword: "An excluded keyword removed the posting",
  excluded_company: "Company is on your excluded list",
  employment_type_mismatch: "Employment type was not selected",
  industry_mismatch: "Industry did not match your selection",
  expired_or_removed: "Posting expired or was removed",
  stale_posting: "Posting was too old",
  sponsorship_unavailable: "Visa sponsorship was unavailable",
  below_match_threshold: "Overall match score was below your threshold",
  insufficient_information: "Posting had too little information to evaluate",
  insufficient_metadata: "Public listing metadata was incomplete",
  low_confidence_public_snippet: "Public snippet was too thin to confirm eligibility",
  other: "Other reasons",
};

export function categorizeExclusionReason(reason: string): FilterImpactCategory {
  const normalized = reason.toLowerCase();
  if (normalized.includes("does not match desired roles")) return "title_mismatch";
  if (normalized.includes("profession")) return "profession_mismatch";
  if (normalized.includes("location")) return "location_mismatch";
  if (normalized.includes("below minimum")) return "salary_below_minimum";
  if (normalized.includes("years; profile has")) return "experience_mismatch";
  if (normalized.includes("seniority")) return "seniority_mismatch";
  if (normalized.includes("work mode")) return "work_mode_mismatch";
  if (normalized.includes("missing required skills")) return "missing_skills";
  if (
    normalized.includes("qualification mismatch") ||
    normalized.includes("required qualification")
  ) {
    return "qualification_mismatch";
  }
  if (
    normalized.includes("excluded keyword") ||
    normalized.includes("blocked keyword")
  ) {
    return "excluded_keyword";
  }
  if (normalized.includes("is excluded")) return "excluded_company";
  if (normalized.includes("employment type")) return "employment_type_mismatch";
  if (normalized.includes("industry")) return "industry_mismatch";
  if (
    normalized.includes("closing date has passed") ||
    normalized.includes("removed this posting")
  ) {
    return "expired_or_removed";
  }
  if (normalized.includes("days old")) return "stale_posting";
  if (normalized.includes("sponsorship")) return "sponsorship_unavailable";
  if (normalized.includes("below threshold")) return "below_match_threshold";
  if (normalized.includes("insufficient job information")) {
    return "insufficient_information";
  }
  if (normalized.includes("incomplete metadata")) {
    return "insufficient_metadata";
  }
  if (normalized.includes("public snippet")) {
    return "low_confidence_public_snippet";
  }
  return "other";
}

export type FilterImpact = Partial<Record<FilterImpactCategory, number>>;

export function buildFilterImpact(reasons: string[]): FilterImpact {
  const impact: FilterImpact = {};
  for (const reason of reasons) {
    const category = categorizeExclusionReason(reason);
    impact[category] = (impact[category] ?? 0) + 1;
  }
  return impact;
}

export type RecoveryActionId =
  | "retry_sources"
  | "include_remote"
  | "lower_match_threshold"
  | "reduce_salary_minimum"
  | "review_preferences"
  | "review_profile"
  | "review_sources"
  | "view_existing_jobs";

export interface ZeroResultDiagnosis {
  explanation: string[];
  suggestedActions: RecoveryActionId[];
}

export interface DiagnosisInput {
  discovered: number;
  excludedCount: number;
  duplicates: number;
  filterImpact: FilterImpact;
  sources: Array<{
    source: string;
    requested?: boolean;
    success: boolean;
    fetched: number;
    error?: string;
  }>;
  plan: {
    titles: string[];
    locations: string[];
  } | null;
}

const CATEGORY_ACTIONS: Partial<
  Record<FilterImpactCategory, RecoveryActionId>
> = {
  location_mismatch: "include_remote",
  work_mode_mismatch: "include_remote",
  salary_below_minimum: "reduce_salary_minimum",
  below_match_threshold: "lower_match_threshold",
  title_mismatch: "lower_match_threshold",
  seniority_mismatch: "review_preferences",
  experience_mismatch: "review_preferences",
  missing_skills: "review_profile",
  qualification_mismatch: "review_profile",
  excluded_keyword: "review_preferences",
  industry_mismatch: "review_preferences",
  employment_type_mismatch: "review_preferences",
  excluded_company: "review_preferences",
  sponsorship_unavailable: "review_preferences",
  expired_or_removed: "retry_sources",
  stale_posting: "retry_sources",
};

export function buildZeroResultDiagnosis(
  input: DiagnosisInput
): ZeroResultDiagnosis {
  const explanation: string[] = [];
  const actions: RecoveryActionId[] = [];
  const requested = input.sources.filter((source) => source.requested !== false);
  const failed = requested.filter((source) => !source.success);
  const succeeded = requested.filter((source) => source.success);

  if (requested.length > 0 && failed.length === requested.length) {
    const details = failed
      .map((source) => {
        const error = source.error ?? "";
        if (/quota.*exhaust/i.test(error)) return `${source.source}: quota exhausted`;
        if (/rate.?limit/i.test(error)) return `${source.source}: rate limited`;
        if (/timed out|timeout/i.test(error)) return `${source.source}: timed out`;
        if (/not configured|setup_required|misconfigured/i.test(error)) {
          return `${source.source}: public discovery unconfigured`;
        }
        if (/authentication|disconnected|connection required/i.test(error)) {
          return `${source.source}: authenticated connection required`;
        }
        return null;
      })
      .filter((detail): detail is string => Boolean(detail));
    return {
      explanation: [
        `All ${requested.length} job sources failed to respond (${failed
          .map((source) => source.source)
          .join(", ")}). This is usually temporary.`,
        ...(details.length > 0 ? [details.join("; ")] : []),
      ],
      suggestedActions: [
        "retry_sources",
        "review_sources",
      ],
    };
  }

  if (failed.length > 0) {
    explanation.push(
      `${failed.map((source) => source.source).join(", ")} ${
        failed.length === 1 ? "was" : "were"
      } unavailable, so the search continued with ${succeeded.length} other ${
        succeeded.length === 1 ? "source" : "sources"
      }.`
    );
    actions.push("retry_sources");
    const unconfigured = failed.filter((source) =>
      /not configured|setup_required|misconfigured/i.test(source.error ?? "")
    );
    const rateLimited = failed.filter((source) =>
      /rate.?limit/i.test(source.error ?? "")
    );
    const quotaExhausted = failed.filter((source) =>
      /quota.*exhaust/i.test(source.error ?? "")
    );
    const timedOut = failed.filter((source) =>
      /timed out|timeout/i.test(source.error ?? "")
    );
    const disconnected = failed.filter((source) =>
      /authentication|disconnected|connection required/i.test(
        source.error ?? ""
      )
    );
    if (unconfigured.length > 0) {
      explanation.push(
        `${unconfigured
          .map((source) => source.source)
          .join(", ")} public discovery is not configured. Direct ATS, company, and official sources still ran independently.`
      );
      actions.push("review_sources");
    }
    if (quotaExhausted.length > 0) {
      explanation.push(
        `${quotaExhausted
          .map((source) => source.source)
          .join(", ")} reached its public-discovery provider quota.`
      );
    } else if (rateLimited.length > 0) {
      explanation.push(
        `${rateLimited
          .map((source) => source.source)
          .join(", ")} was rate limited; retry after the source cooldown.`
      );
    }
    if (timedOut.length > 0) {
      explanation.push(
        `${timedOut
          .map((source) => source.source)
          .join(", ")} did not respond before the safe timeout.`
      );
    }
    if (disconnected.length > 0) {
      explanation.push(
        `${disconnected
          .map((source) => source.source)
          .join(", ")} requires an authenticated connection for that access method.`
      );
      actions.push("review_sources");
    }
  }

  if (input.discovered === 0) {
    if (!input.plan?.titles.length) {
      explanation.push(
        "No target role is available in the current search profile, so Kairela cannot build a relevant query."
      );
      actions.push("review_profile", "review_preferences");
      return { explanation, suggestedActions: [...new Set(actions)] };
    }
    if (!input.plan.locations.length) {
      explanation.push(
        "No preferred location is available in the current search profile."
      );
      actions.push("include_remote", "review_preferences");
      return { explanation, suggestedActions: [...new Set(actions)] };
    }
    const titles = input.plan?.titles.length
      ? ` for ${input.plan.titles.slice(0, 3).join(", ")}`
      : "";
    const locations = input.plan?.locations.length
      ? ` in ${input.plan.locations.slice(0, 3).join(", ")}`
      : "";
    explanation.push(
      `The sources that responded returned no current postings${titles}${locations}.`
    );
    actions.push("include_remote", "review_preferences");
    return { explanation, suggestedActions: [...new Set(actions)] };
  }

  const ranked = (
    Object.entries(input.filterImpact) as Array<[FilterImpactCategory, number]>
  )
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);

  if (ranked.length > 0) {
    const [category, count] = ranked[0];
    explanation.push(
      `We found ${input.discovered} ${
        input.discovered === 1 ? "job" : "jobs"
      }, but none passed your filters. The largest reason was ${FILTER_IMPACT_LABELS[
        category
      ].toLowerCase()} (${count} ${count === 1 ? "job" : "jobs"}).`
    );
    for (const [rankedCategory] of ranked.slice(0, 3)) {
      const action = CATEGORY_ACTIONS[rankedCategory];
      if (action) actions.push(action);
    }
  } else if (input.duplicates > 0 && input.excludedCount === 0) {
    explanation.push(
      `We found ${input.discovered} postings, but they were duplicates of jobs already in your workspace.`
    );
    actions.push("view_existing_jobs");
  } else {
    explanation.push(
      `We found ${input.discovered} postings, but none passed your current filters.`
    );
    actions.push("review_preferences");
  }

  return { explanation, suggestedActions: [...new Set(actions)] };
}

export interface SearchRejectionDiagnostics {
  discovered: number;
  acceptedRelevant: number;
  potentialMatches: number;
  rejectedByTitle: number;
  rejectedByLocation: number;
  rejectedByExperience: number;
  rejectedBySkills: number;
  rejectedByQualification: number;
  rejectedBySector: number;
  rejectedBySeniority: number;
  rejectedByWorkMode: number;
  rejectedMissingMetadata: number;
  rejectedExpired: number;
  rejectedBelowThreshold: number;
  otherRejections: number;
}

export function buildSearchRejectionDiagnostics(input: {
  discovered: number;
  filtered: Array<{ analysis?: { classification?: string } }>;
  excluded: Array<{
    analysis?: {
      classification?: string;
      rejectionCode?: string;
      exclusions?: string[];
    };
  }>;
}): SearchRejectionDiagnostics {
  const potentialMatches = input.filtered.filter(
    (job) =>
      job.analysis?.classification === "POTENTIAL_MATCH_REQUIRES_VERIFICATION"
  ).length;
  const acceptedRelevant = input.filtered.length - potentialMatches;
  const counts: SearchRejectionDiagnostics = {
    discovered: input.discovered,
    acceptedRelevant,
    potentialMatches,
    rejectedByTitle: 0,
    rejectedByLocation: 0,
    rejectedByExperience: 0,
    rejectedBySkills: 0,
    rejectedByQualification: 0,
    rejectedBySector: 0,
    rejectedBySeniority: 0,
    rejectedByWorkMode: 0,
    rejectedMissingMetadata: 0,
    rejectedExpired: 0,
    rejectedBelowThreshold: 0,
    otherRejections: 0,
  };

  for (const entry of input.excluded) {
    const code = entry.analysis?.rejectionCode;
    const category = code
      ? code === "title_mismatch" || code === "profession_mismatch"
        ? "rejectedByTitle"
        : code === "location_mismatch"
          ? "rejectedByLocation"
          : code === "experience_too_high" || code === "experience_too_low"
            ? "rejectedByExperience"
            : code === "qualification_mismatch"
              ? "rejectedByQualification"
              : code === "sector_mismatch"
                ? "rejectedBySector"
                : code === "seniority_mismatch"
                  ? "rejectedBySeniority"
                  : code === "work_mode_mismatch"
                    ? "rejectedByWorkMode"
                    : code === "insufficient_metadata" ||
                        code === "insufficient_information"
                      ? "rejectedMissingMetadata"
                      : code === "expired"
                        ? "rejectedExpired"
                        : code === "below_match_threshold"
                          ? "rejectedBelowThreshold"
                          : "otherRejections"
      : (() => {
          const impact = categorizeExclusionReason(
            entry.analysis?.exclusions?.[0] ?? ""
          );
          if (impact === "title_mismatch" || impact === "profession_mismatch") {
            return "rejectedByTitle";
          }
          if (impact === "location_mismatch") return "rejectedByLocation";
          if (impact === "experience_mismatch") return "rejectedByExperience";
          if (impact === "missing_skills") return "rejectedBySkills";
          if (impact === "qualification_mismatch") {
            return "rejectedByQualification";
          }
          if (impact === "industry_mismatch") return "rejectedBySector";
          if (impact === "seniority_mismatch") return "rejectedBySeniority";
          if (impact === "work_mode_mismatch") return "rejectedByWorkMode";
          if (
            impact === "insufficient_information" ||
            impact === "insufficient_metadata"
          ) {
            return "rejectedMissingMetadata";
          }
          if (impact === "expired_or_removed" || impact === "stale_posting") {
            return "rejectedExpired";
          }
          if (impact === "below_match_threshold") {
            return "rejectedBelowThreshold";
          }
          return "otherRejections";
        })();
    counts[category] += 1;
  }

  return counts;
}
