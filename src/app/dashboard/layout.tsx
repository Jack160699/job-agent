import { AppShell } from "@/components/dashboard/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConsultantFab } from "@/components/consultant/consultant-fab";
import { ensureOnboardingFromPath } from "@/lib/onboarding/gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureOnboardingFromPath();
  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
      <ConsultantFab />
    </AppShell>
  );
}
