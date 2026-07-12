"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Settings {
  jobTitles: string[];
  experienceYears: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  locations: string[];
  matchThreshold: number;
  autoSubmitEnabled: boolean;
  requireReview: boolean;
  searchFrequencyHours: number;
  notificationsEnabled: boolean;
  gmailSyncEnabled: boolean;
  sheetsSyncEnabled: boolean;
  calendarSyncEnabled: boolean;
}

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: Settings | null;
}) {
  const [loading, setLoading] = useState(false);
  const [jobTitles, setJobTitles] = useState(
    initialSettings?.jobTitles?.join(", ") || "Software Engineer"
  );
  const [locations, setLocations] = useState(
    initialSettings?.locations?.join(", ") || "Remote"
  );
  const [experienceYears, setExperienceYears] = useState(
    initialSettings?.experienceYears?.toString() || "3"
  );
  const [salaryMin, setSalaryMin] = useState(
    initialSettings?.salaryMin?.toString() || ""
  );
  const [salaryMax, setSalaryMax] = useState(
    initialSettings?.salaryMax?.toString() || ""
  );
  const [matchThreshold, setMatchThreshold] = useState(
    initialSettings?.matchThreshold?.toString() || "70"
  );
  const [requireReview, setRequireReview] = useState(
    initialSettings?.requireReview ?? true
  );
  const [autoSubmit, setAutoSubmit] = useState(
    initialSettings?.autoSubmitEnabled ?? false
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitles: jobTitles.split(",").map((s) => s.trim()).filter(Boolean),
          locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
          experienceYears: parseInt(experienceYears) || null,
          salaryMin: salaryMin ? parseInt(salaryMin) : null,
          salaryMax: salaryMax ? parseInt(salaryMax) : null,
          matchThreshold: parseFloat(matchThreshold) || 70,
          requireReview,
          autoSubmitEnabled: autoSubmit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs defaultValue="filters" className="space-y-6">
      <TabsList>
        <TabsTrigger value="filters">Job Filters</TabsTrigger>
        <TabsTrigger value="automation">Automation</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
      </TabsList>

      <TabsContent value="filters">
        <Card>
          <CardHeader>
            <CardTitle>Search Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Job Titles (comma-separated)</Label>
              <Input
                value={jobTitles}
                onChange={(e) => setJobTitles(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Locations (comma-separated)</Label>
              <Input
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Experience (years)</Label>
                <Input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Min</Label>
                <Input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="80000"
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Max</Label>
                <Input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="150000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Match Threshold (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="automation">
        <Card>
          <CardHeader>
            <CardTitle>Automation Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={requireReview}
                onChange={(e) => setRequireReview(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Require review before submission
                </p>
                <p className="text-xs text-zinc-500">
                  Pause for your approval before final application submit
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={autoSubmit}
                onChange={(e) => setAutoSubmit(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Enable auto-submit (Greenhouse, Lever, Ashby only)
                </p>
                <p className="text-xs text-zinc-500">
                  Automatically submit on supported ATS platforms when review is disabled
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations">
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <IntegrationItem
              name="Gmail"
              description="Sync recruiter emails"
              enabled={initialSettings?.gmailSyncEnabled ?? false}
            />
            <IntegrationItem
              name="Google Sheets"
              description="Export application tracker"
              enabled={initialSettings?.sheetsSyncEnabled ?? false}
            />
            <IntegrationItem
              name="Google Calendar"
              description="Sync interview schedule"
              enabled={initialSettings?.calendarSyncEnabled ?? false}
            />
            <IntegrationItem
              name="Google Drive"
              description="Store resume and cover letter files"
              enabled={false}
            />
            <p className="text-xs text-zinc-500">
              Configure Google OAuth credentials in environment variables to enable integrations.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <Button onClick={handleSave} disabled={loading} className="gap-2">
        <Save className="h-4 w-4" />
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </Tabs>
  );
}

function IntegrationItem({
  name,
  description,
  enabled,
}: {
  name: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-200">{name}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          enabled
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-zinc-800 text-zinc-500"
        }`}
      >
        {enabled ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}
