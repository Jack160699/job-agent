import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileBottomNav } from "@/components/dashboard/mobile-nav";
import { ErrorBoundary } from "@/components/error-boundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="md:ml-[var(--sidebar-width)]">
        <div className="dashboard-content mx-auto max-w-[var(--content-max)]">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
