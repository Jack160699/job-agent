export default function ResumeHistoryLoading() {
  return (
    <div
      className="space-y-4 p-4 md:p-6"
      aria-busy="true"
      aria-label="Loading resume history"
    >
      <div className="h-8 w-52 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-2)]" />
      </div>
      <div className="h-10 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  );
}
