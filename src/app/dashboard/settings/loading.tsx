export default function SettingsLoading() {
  return (
    <div data-navigation-loading className="space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading settings">
      <div className="h-8 w-36 animate-pulse rounded bg-[var(--surface-2)]" />
      <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-[var(--surface-2)]" />
      <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-2)]" />
    </div>
  );
}
