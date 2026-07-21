import {
  isPotentialMatchClassification,
} from "@/lib/applications/answer-bank-service";

export type MatchAnalysisGate = {
  classification?: string | null;
  requiresVerification?: boolean;
  eligibilityVerified?: boolean;
  unknownSignals?: string[];
  matchedSignals?: string[];
} | null;

export function isEligibilityVerified(analysis: MatchAnalysisGate): boolean {
  if (!analysis) return true;
  if (!isPotentialMatchClassification(analysis.classification)) {
    return true;
  }
  return analysis.eligibilityVerified === true;
}

export function assertApplicationReadyForDocuments(analysis: unknown): void {
  const matchAnalysis = (analysis ?? null) as MatchAnalysisGate;
  if (isEligibilityVerified(matchAnalysis)) return;
  throw new Error("POTENTIAL_MATCH_REQUIRES_VERIFICATION");
}

export function assertApplicationReadyForPreparation(analysis: unknown): void {
  assertApplicationReadyForDocuments(analysis);
}
