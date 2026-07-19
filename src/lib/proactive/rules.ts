export type RecommendationPriority = "low" | "medium" | "high";

export interface RecommendationEvidence {
  label: string;
  value: string | number;
}

export interface RecommendationCandidate {
  type: string;
  category: string;
  priority: RecommendationPriority;
  title: string;
  body: string;
  reason: string;
  evidence: RecommendationEvidence[];
  suggestedAction: string;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface RecommendationSnapshot {
  preferencesComplete: boolean;
  hasResume: boolean;
  activeJobCount: number;
  strongMatchCount: number;
  strongestMatch?: {
    title: string;
    company: string;
    score: number;
  };
  newHighMatchCount: number;
  closingSoonCount: number;
  governmentDeadlineCount: number;
  lastSearchAt?: Date;
  pendingReviewCount: number;
  unreadRecruiterReplies: number;
  nextInterview?: {
    title: string;
    company?: string;
    scheduledAt: Date;
  };
  integrationReconnectRequired: boolean;
  usageNearLimit?: {
    feature: string;
    remaining: number;
    limit: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildRecommendationCandidates(
  snapshot: RecommendationSnapshot,
  now = new Date()
): RecommendationCandidate[] {
  const recommendations: RecommendationCandidate[] = [];

  if (!snapshot.preferencesComplete || !snapshot.hasResume) {
    const missing = [
      !snapshot.preferencesComplete ? "search preferences" : null,
      !snapshot.hasResume ? "master resume" : null,
    ].filter(Boolean);
    recommendations.push({
      type: "profile_incomplete",
      category: "profile",
      priority: "high",
      title: "Complete your career profile",
      body: `Add your ${missing.join(" and ")} so Kairela can ground matches in your real experience.`,
      reason: "Incomplete profile data reduces match quality and blocks document tailoring.",
      evidence: [{ label: "Missing", value: missing.join(", ") }],
      suggestedAction: "Complete the missing profile information.",
      actionUrl: !snapshot.preferencesComplete
        ? "/dashboard/onboarding"
        : "/dashboard/resumes",
    });
  }

  const searchAgeDays = snapshot.lastSearchAt
    ? Math.floor((now.getTime() - snapshot.lastSearchAt.getTime()) / DAY_MS)
    : null;
  if (
    snapshot.preferencesComplete &&
    (snapshot.activeJobCount === 0 || searchAgeDays === null || searchAgeDays >= 7)
  ) {
    recommendations.push({
      type: "search_stale",
      category: "search",
      priority: snapshot.activeJobCount === 0 ? "high" : "medium",
      title:
        snapshot.activeJobCount === 0
          ? "Start a preference-aware job search"
          : "Refresh your job search",
      body:
        snapshot.activeJobCount === 0
          ? "Your preferences are ready, but there are no active roles in your pipeline."
          : "Your last completed search is over a week old, so newer roles may be available.",
      reason: "Fresh searches improve the chance of finding active, relevant postings.",
      evidence: [
        { label: "Active roles", value: snapshot.activeJobCount },
        {
          label: "Last search",
          value: searchAgeDays === null ? "Never" : `${searchAgeDays} days ago`,
        },
      ],
      suggestedAction: "Run a new search using your saved preferences.",
      actionUrl: "/dashboard/jobs",
      expiresAt: new Date(now.getTime() + 3 * DAY_MS),
    });
  }

  if (snapshot.strongMatchCount > 0 && snapshot.strongestMatch) {
    const match = snapshot.strongestMatch;
    recommendations.push({
      type: "strong_match",
      category: "matches",
      priority: "high",
      title: `${snapshot.strongMatchCount} strong match${snapshot.strongMatchCount === 1 ? "" : "es"} found`,
      body: `${match.title} at ${match.company} is currently your strongest match.`,
      reason: "This role meets your configured match threshold based on available job data.",
      evidence: [
        { label: "Strong matches", value: snapshot.strongMatchCount },
        { label: "Top match score", value: `${Math.round(match.score)}%` },
      ],
      suggestedAction: "Review the match explanation before deciding whether to prepare an application.",
      actionUrl: "/dashboard/matches",
      expiresAt: new Date(now.getTime() + 7 * DAY_MS),
    });
  }

  if (snapshot.newHighMatchCount > 0) {
    recommendations.push({
      type: "new_high_match",
      category: "matches",
      priority: "high",
      title: `${snapshot.newHighMatchCount} new high-match role${snapshot.newHighMatchCount === 1 ? "" : "s"}`,
      body: "These roles were newly discovered in the last 24 hours and meet your configured match threshold.",
      reason: "Reviewing fresh high-match roles early can help you act before a posting closes.",
      evidence: [{ label: "New high matches", value: snapshot.newHighMatchCount }],
      suggestedAction: "Review the new matches and their source evidence.",
      actionUrl: "/dashboard/jobs",
      expiresAt: new Date(now.getTime() + 2 * DAY_MS),
    });
  }

  if (snapshot.closingSoonCount > 0) {
    recommendations.push({
      type: "closing_soon",
      category: "deadlines",
      priority: "high",
      title: `${snapshot.closingSoonCount} saved opportunity deadline${snapshot.closingSoonCount === 1 ? "" : "s"} approaching`,
      body: "One or more active opportunities close within the next three days.",
      reason: "Closing-soon alerts help prevent a verified deadline from passing unnoticed.",
      evidence: [{ label: "Closing within 72 hours", value: snapshot.closingSoonCount }],
      suggestedAction: "Open the official posting and verify the deadline before preparing an application.",
      actionUrl: "/dashboard/jobs",
      expiresAt: new Date(now.getTime() + 3 * DAY_MS),
    });
  }

  if (snapshot.governmentDeadlineCount > 0) {
    recommendations.push({
      type: "government_deadline",
      category: "deadlines",
      priority: "high",
      title: `${snapshot.governmentDeadlineCount} government deadline${snapshot.governmentDeadlineCount === 1 ? "" : "s"} approaching`,
      body: "Official government opportunities in your results close within the next seven days.",
      reason: "Government application windows are strict and should be confirmed on the official notice.",
      evidence: [
        {
          label: "Official deadlines within 7 days",
          value: snapshot.governmentDeadlineCount,
        },
      ],
      suggestedAction: "Review eligibility and the official notification before the deadline.",
      actionUrl: "/dashboard/jobs",
      expiresAt: new Date(now.getTime() + 7 * DAY_MS),
    });
  }

  if (snapshot.pendingReviewCount > 0) {
    recommendations.push({
      type: "application_review",
      category: "applications",
      priority: "high",
      title: `${snapshot.pendingReviewCount} application${snapshot.pendingReviewCount === 1 ? "" : "s"} need review`,
      body: "Prepared application materials are waiting for your approval.",
      reason: "Kairela never submits prepared applications without the required authorization.",
      evidence: [{ label: "Awaiting review", value: snapshot.pendingReviewCount }],
      suggestedAction: "Check every answer and document before approving submission.",
      actionUrl: "/dashboard/applications",
      expiresAt: new Date(now.getTime() + 3 * DAY_MS),
    });
  }

  if (snapshot.unreadRecruiterReplies > 0) {
    recommendations.push({
      type: "recruiter_reply",
      category: "communication",
      priority: "high",
      title: "A recruiter reply needs attention",
      body: `You have ${snapshot.unreadRecruiterReplies} unread recruiter message${snapshot.unreadRecruiterReplies === 1 ? "" : "s"}.`,
      reason: "Timely, thoughtful replies can keep active hiring conversations moving.",
      evidence: [{ label: "Unread replies", value: snapshot.unreadRecruiterReplies }],
      suggestedAction: "Review the thread and draft a truthful response.",
      actionUrl: "/dashboard/inbox",
      expiresAt: new Date(now.getTime() + 2 * DAY_MS),
    });
  }

  if (snapshot.nextInterview) {
    const hoursUntil = Math.ceil(
      (snapshot.nextInterview.scheduledAt.getTime() - now.getTime()) /
        (60 * 60 * 1000)
    );
    if (hoursUntil >= 0 && hoursUntil <= 72) {
      recommendations.push({
        type: "interview_approaching",
        category: "interviews",
        priority: hoursUntil <= 24 ? "high" : "medium",
        title: "Your interview is approaching",
        body: `${snapshot.nextInterview.title}${snapshot.nextInterview.company ? ` with ${snapshot.nextInterview.company}` : ""} starts in about ${hoursUntil} hours.`,
        reason: "A focused preparation plan can help you use the remaining time well.",
        evidence: [
          { label: "Scheduled", value: snapshot.nextInterview.scheduledAt.toISOString() },
          { label: "Time remaining", value: `${hoursUntil} hours` },
        ],
        suggestedAction: "Review the role, prepare examples, and confirm logistics.",
        actionUrl: "/dashboard/calendar",
        expiresAt: snapshot.nextInterview.scheduledAt,
      });
    }
  }

  if (snapshot.integrationReconnectRequired) {
    recommendations.push({
      type: "google_reconnect",
      category: "integrations",
      priority: "medium",
      title: "Reconnect your Google integration",
      body: "A Google feature is enabled, but Kairela cannot access the authorized connection.",
      reason: "Recruiter sync, calendar updates, or document backup may pause until reconnection.",
      evidence: [{ label: "Connection", value: "Authorization unavailable" }],
      suggestedAction: "Reconnect only the Google features you want to use.",
      actionUrl: "/dashboard/settings",
    });
  }

  if (snapshot.usageNearLimit) {
    const usage = snapshot.usageNearLimit;
    recommendations.push({
      type: "usage_limit",
      category: "account",
      priority: usage.remaining === 0 ? "high" : "low",
      title: usage.remaining === 0 ? "Usage limit reached" : "Usage limit is close",
      body: `${usage.remaining} of ${usage.limit} ${usage.feature.replaceAll("_", " ")} actions remain in this period.`,
      reason: "Knowing the remaining allowance helps you plan without surprise interruptions.",
      evidence: [
        { label: "Remaining", value: usage.remaining },
        { label: "Period limit", value: usage.limit },
      ],
      suggestedAction: "Prioritize important actions; billing remains disabled until explicitly activated.",
      actionUrl: "/dashboard/settings",
    });
  }

  return recommendations;
}

export function prioritizeRecommendations(
  candidates: RecommendationCandidate[],
  disabledCategories: string[],
  limit = 5
): RecommendationCandidate[] {
  const weight: Record<RecommendationPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  return candidates
    .filter((candidate) => !disabledCategories.includes(candidate.category))
    .sort((a, b) => weight[b.priority] - weight[a.priority])
    .slice(0, limit);
}
