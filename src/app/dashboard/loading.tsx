export default function DashboardLoading() {
  return (
    <div data-navigation-loading className="space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-2)]" />
        <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-2)]" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  );
}
