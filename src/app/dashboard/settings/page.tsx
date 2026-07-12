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
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
