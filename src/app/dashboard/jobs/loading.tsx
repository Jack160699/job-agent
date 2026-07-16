export default function JobsLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading jobs">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--surface-2)]" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  );
}
