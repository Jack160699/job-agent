import { createHash, randomUUID } from "node:crypto";

export type SafeFixStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type SafeFixActionType =
  | "ACCEPT"
  | "REJECT"
  | "ACCEPT_ALL_SAFE"
  | "REJECT_ALL"
  | "UNDO_LAST"
  | "UNDO_ALL";

export interface SafeFixProposal {
  id: string;
  resumeVersion: number;
  section: string;
  originalContent: string;
  proposedContent: string;
  category:
    | "GRAMMAR"
    | "PUNCTUATION"
    | "STANDARDIZED_HEADING"
    | "DATE_FORMATTING"
    | "DUPLICATE_WORDING"
    | "BULLET_SHORTENING"
    | "SECTION_ORDERING"
    | "ACTION_VERB"
    | "WHITESPACE";
  explanation: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  sourceEvidence: string;
  deterministicValidation: {
    safe: boolean;
    reason: string;
  };
  requiresConfirmation: boolean;
  status: SafeFixStatus;
  acceptedAt: string | null;
  rejectedAt: string | null;
  userId: string;
  actionId: string | null;
}

export interface SafeFixReviewAction {
  id: string;
  type: SafeFixActionType;
  fixIds: string[];
  beforeRawText: string;
  afterRawText: string;
  beforeContent: unknown;
  afterContent: unknown;
  userId: string;
  createdAt: string;
  undoneAt: string | null;
}

export interface SafeFixReviewState {
  version: "safe-fix-review-v1";
  sessionId: string;
  fixes: SafeFixProposal[];
  actions: SafeFixReviewAction[];
}

type Claim = {
  category?: string;
  claim?: string;
  sourceSection?: string;
  sourceExcerpt?: string | null;
  state?: string;
  aiImproved?: boolean;
  reviewRequired?: boolean;
};

export type ReviewableGroundingReport = Record<string, unknown> & {
  claims?: Claim[];
  safeFixReview?: SafeFixReviewState;
};

const FORBIDDEN_FACT_CATEGORIES = new Set([
  "employer",
  "position",
  "job_title",
  "client",
  "employment_date",
  "education",
  "qualification",
  "institution",
  "certification",
  "project",
  "skill",
  "metric",
  "salary",
  "government_eligibility",
  "legal_declaration",
]);

function normalizedTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#.%]+/)
    .filter(Boolean);
}

function numbers(value: string) {
  return value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
}

function validateMeaningPreserved(
  originalContent: string,
  proposedContent: string,
  claimCategory: string
) {
  const originalNumbers = new Set(numbers(originalContent));
  const introducedNumbers = numbers(proposedContent).filter(
    (value) => !originalNumbers.has(value)
  );
  if (introducedNumbers.length > 0) {
    return {
      safe: false,
      reason: "The proposal introduces a number not present in the source.",
    };
  }
  if (FORBIDDEN_FACT_CATEGORIES.has(claimCategory)) {
    return {
      safe: false,
      reason: "Factual identity, qualification, skill, date, or metric changes require confirmation.",
    };
  }

  const original = new Set(normalizedTokens(originalContent));
  const proposed = normalizedTokens(proposedContent);
  const overlap =
    proposed.length === 0
      ? 0
      : proposed.filter((token) => original.has(token)).length / proposed.length;
  return overlap >= 0.6
    ? { safe: true, reason: "Wording overlap and numeric evidence checks passed." }
    : {
        safe: false,
        reason: "The wording differs too much for deterministic auto-approval.",
      };
}

function stableFixId(
  resumeId: string,
  resumeVersion: number,
  section: string,
  originalContent: string,
  proposedContent: string
) {
  return `fix_${createHash("sha256")
    .update(
      [resumeId, resumeVersion, section, originalContent, proposedContent].join(
        "\u0000"
      )
    )
    .digest("hex")
    .slice(0, 20)}`;
}

function proposalFromClaim(
  claim: Claim,
  context: { resumeId: string; resumeVersion: number; userId: string }
): SafeFixProposal | null {
  const originalContent = claim.sourceExcerpt?.trim();
  const proposedContent = claim.claim?.trim();
  if (
    !originalContent ||
    !proposedContent ||
    originalContent === proposedContent ||
    claim.state !== "AI_REWORDED"
  ) {
    return null;
  }
  const claimCategory = claim.category ?? "summary";
  const validation = validateMeaningPreserved(
    originalContent,
    proposedContent,
    claimCategory
  );
  const section = claim.sourceSection ?? "Resume";
  return {
    id: stableFixId(
      context.resumeId,
      context.resumeVersion,
      section,
      originalContent,
      proposedContent
    ),
    resumeVersion: context.resumeVersion,
    section,
    originalContent,
    proposedContent,
    category:
      claimCategory === "responsibility" || claimCategory === "achievement"
        ? "ACTION_VERB"
        : "GRAMMAR",
    explanation:
      claimCategory === "responsibility" || claimCategory === "achievement"
        ? "Improve action-oriented wording while preserving the source meaning."
        : "Improve clarity and grammar while preserving the source meaning.",
    riskLevel: validation.safe ? "LOW" : "MEDIUM",
    sourceEvidence: originalContent,
    deterministicValidation: validation,
    requiresConfirmation: !validation.safe,
    status: "PENDING",
    acceptedAt: null,
    rejectedAt: null,
    userId: context.userId,
    actionId: null,
  };
}

function formattingProposals(
  rawText: string,
  context: { resumeId: string; resumeVersion: number; userId: string }
) {
  const proposals: SafeFixProposal[] = [];
  for (const line of rawText.split(/\r?\n/)) {
    const normalized = line.replace(/[ \t]{2,}/g, " ").trimEnd();
    if (line && normalized !== line) {
      proposals.push({
        id: stableFixId(
          context.resumeId,
          context.resumeVersion,
          "Formatting",
          line,
          normalized
        ),
        resumeVersion: context.resumeVersion,
        section: "Formatting",
        originalContent: line,
        proposedContent: normalized,
        category: "WHITESPACE",
        explanation: "Normalize repeated whitespace without changing wording.",
        riskLevel: "LOW",
        sourceEvidence: line,
        deterministicValidation: {
          safe: true,
          reason: "Only whitespace changes.",
        },
        requiresConfirmation: false,
        status: "PENDING",
        acceptedAt: null,
        rejectedAt: null,
        userId: context.userId,
        actionId: null,
      });
    }
  }
  return proposals;
}

export function ensureSafeFixReview(
  report: ReviewableGroundingReport,
  context: {
    resumeId: string;
    resumeVersion: number;
    userId: string;
    rawText: string;
  }
): ReviewableGroundingReport {
  if (report.safeFixReview?.version === "safe-fix-review-v1") return report;
  const candidates = [
    ...(report.claims ?? [])
      .map((claim) => proposalFromClaim(claim, context))
      .filter((fix): fix is SafeFixProposal => Boolean(fix)),
    ...formattingProposals(context.rawText, context),
  ];
  const unique = new Map(candidates.map((fix) => [fix.id, fix]));
  return {
    ...report,
    safeFixReview: {
      version: "safe-fix-review-v1",
      sessionId: randomUUID(),
      fixes: [...unique.values()],
      actions: [],
    },
  };
}

function replaceFirst(value: string, original: string, proposed: string) {
  const index = value.indexOf(original);
  if (index < 0) return value;
  return `${value.slice(0, index)}${proposed}${value.slice(index + original.length)}`;
}

export function replaceStringsInJson(
  value: unknown,
  original: string,
  proposed: string
): unknown {
  if (typeof value === "string") return replaceFirst(value, original, proposed);
  if (Array.isArray(value)) {
    return value.map((item) => replaceStringsInJson(item, original, proposed));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceStringsInJson(item, original, proposed),
      ])
    );
  }
  return value;
}

export function applySafeFixAction(input: {
  report: ReviewableGroundingReport;
  rawText: string;
  content: unknown;
  action: SafeFixActionType;
  fixId?: string;
  userId: string;
  confirmed?: boolean;
  now?: Date;
}) {
  const review = input.report.safeFixReview;
  if (!review) throw new Error("Safe-fix review is not initialized");
  if (
    review.fixes.some((fix) => fix.userId !== input.userId) ||
    review.actions.some((action) => action.userId !== input.userId)
  ) {
    throw new Error("Safe-fix review ownership does not match");
  }
  const now = (input.now ?? new Date()).toISOString();
  const fixes = review.fixes.map((fix) => ({ ...fix }));
  const actions = review.actions.map((action) => ({ ...action }));
  let rawText = input.rawText;
  let content = input.content;
  let changedContent = false;
  const pending = fixes.filter((fix) => fix.status === "PENDING");

  if (input.action === "UNDO_LAST" || input.action === "UNDO_ALL") {
    const accepted = actions.filter(
      (action) =>
        (action.type === "ACCEPT" || action.type === "ACCEPT_ALL_SAFE") &&
        !action.undoneAt
    );
    const targets =
      input.action === "UNDO_LAST" ? accepted.slice(-1) : accepted;
    if (targets.length === 0) {
      return { report: input.report, rawText, content, changedContent: false };
    }
    rawText = targets[0].beforeRawText;
    content = targets[0].beforeContent;
    for (const target of targets) {
      target.undoneAt = now;
      for (const fix of fixes) {
        if (fix.actionId === target.id) {
          fix.status = "PENDING";
          fix.acceptedAt = null;
          fix.actionId = null;
        }
      }
    }
    changedContent = rawText !== input.rawText;
    actions.push({
      id: randomUUID(),
      type: input.action,
      fixIds: targets.flatMap((target) => target.fixIds),
      beforeRawText: input.rawText,
      afterRawText: rawText,
      beforeContent: input.content,
      afterContent: content,
      userId: input.userId,
      createdAt: now,
      undoneAt: null,
    });
  } else {
    const selected =
      input.action === "ACCEPT_ALL_SAFE" || input.action === "REJECT_ALL"
        ? pending.filter(
            (fix) =>
              input.action === "REJECT_ALL" || !fix.requiresConfirmation
          )
        : fixes.filter(
            (fix) => fix.id === input.fixId && fix.status === "PENDING"
          );
    if (selected.length === 0) {
      return { report: input.report, rawText, content, changedContent: false };
    }
    const actionId = randomUUID();
    const accepting =
      input.action === "ACCEPT" || input.action === "ACCEPT_ALL_SAFE";
    for (const fix of selected) {
      if (
        accepting &&
        fix.requiresConfirmation &&
        input.confirmed !== true
      ) {
        throw new Error("This fix requires explicit factual confirmation");
      }
      if (accepting) {
        const next = replaceFirst(
          rawText,
          fix.originalContent,
          fix.proposedContent
        );
        if (next === rawText) {
          throw new Error("The source text for this fix is no longer current");
        }
        rawText = next;
        content = replaceStringsInJson(
          content,
          fix.originalContent,
          fix.proposedContent
        );
        fix.status = "ACCEPTED";
        fix.acceptedAt = now;
        changedContent = true;
      } else {
        fix.status = "REJECTED";
        fix.rejectedAt = now;
      }
      fix.actionId = actionId;
    }
    actions.push({
      id: actionId,
      type: input.action,
      fixIds: selected.map((fix) => fix.id),
      beforeRawText: input.rawText,
      afterRawText: rawText,
      beforeContent: input.content,
      afterContent: content,
      userId: input.userId,
      createdAt: now,
      undoneAt: null,
    });
  }

  return {
    report: {
      ...input.report,
      safeFixReview: { ...review, fixes, actions },
    },
    rawText,
    content,
    changedContent,
  };
}
