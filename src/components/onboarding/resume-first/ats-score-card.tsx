import type { AtsReadinessScore } from "@/lib/resumes/ats-score";

const RATING_COLOR: Record<AtsReadinessScore["rating"], string> = {
  "Needs improvement": "#a15c00",
  Good: "#2455e6",
  Strong: "#0f8a5f",
};

export function AtsScoreCard({
  score,
  enrichmentPending,
}: {
  score: AtsReadinessScore;
  enrichmentPending?: boolean;
}) {
  const color = RATING_COLOR[score.rating];
  return (
    <section
      aria-label="Kairela ATS Readiness Score"
      className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--rf-ink-secondary)]">
            Your Kairela ATS Readiness Score
          </p>
          <p className="text-2xl font-semibold text-[var(--rf-ink)]">
            {score.totalScore}
            <span className="text-sm font-normal text-[var(--rf-ink-tertiary)]">/100</span>
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {score.rating}
        </span>
      </div>
      <p className="text-xs text-[var(--rf-ink-tertiary)]">{score.ratingExplanation}</p>
      {score.quickFixes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--rf-ink)]">Quick fixes</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-[var(--rf-ink-secondary)]">
            {score.quickFixes.slice(0, 3).map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        </div>
      )}
      {enrichmentPending && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--rf-ink-tertiary)]">
          <span
            className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--rf-primary)] border-t-transparent"
            aria-hidden="true"
          />
          Refining details in the background — this score may update slightly.
        </p>
      )}
      <p className="text-[10px] text-[var(--rf-ink-tertiary)]">
        This is Kairela&apos;s own readiness score, not an official Workday, Greenhouse, Lever,
        Ashby, or LinkedIn score.
      </p>
    </section>
  );
}
