import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard/sidebar";
import { getUserSettings } from "@/lib/data/dashboard";
import { SettingsForm } from "@/components/dashboard/settings-form";

export default async function SettingsPage() {
  const settings = await getUserSettings();

  return (
    <div>
      <DashboardHeader
        title="Settings"
        description="Configure job search filters and automation preferences"
      />
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading settings...</div>}>
        <SettingsForm initialSettings={settings} />
      </Suspense>
    </div>
  );
}
