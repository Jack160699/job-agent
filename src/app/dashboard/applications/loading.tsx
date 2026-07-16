export default function ApplicationsLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading applications">
      <div className="h-8 w-52 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        ))}
      </div>
    </div>
  );
}
