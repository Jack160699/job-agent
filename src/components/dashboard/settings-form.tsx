"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Link2, CheckCircle2 } from "lucide-react";

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
  targetCompanies?: string[];
}

type GoogleStatus = {
  connected: boolean;
  email: string | null;
  integrations: {
    gmail: boolean;
    drive: boolean;
    sheets: boolean;
    calendar: boolean;
  };
};

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: Settings | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [targetCompanies, setTargetCompanies] = useState(
    initialSettings?.targetCompanies?.join(", ") || "openai, stripe, linear"
  );
  const [gmailSync, setGmailSync] = useState(
    initialSettings?.gmailSyncEnabled ?? false
  );
  const [sheetsSync, setSheetsSync] = useState(
    initialSettings?.sheetsSyncEnabled ?? false
  );
  const [calendarSync, setCalendarSync] = useState(
    initialSettings?.calendarSyncEnabled ?? false
  );
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  const applyGoogleStatus = useCallback((status: GoogleStatus) => {
    setGoogleConnected(status.connected);
    setGoogleEmail(status.email);
    if (status.connected) {
      setGmailSync(status.integrations.gmail);
      setSheetsSync(status.integrations.sheets);
      setCalendarSync(status.integrations.calendar);
    }
  }, []);

  const refreshGoogleStatus = useCallback(async () => {
    const res = await fetch("/api/google/status");
    const data = (await res.json()) as GoogleStatus;
    applyGoogleStatus(data);
    return data;
  }, [applyGoogleStatus]);

  useEffect(() => {
    refreshGoogleStatus().catch(() => {});
  }, [refreshGoogleStatus]);

  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (!googleParam) return;

    if (googleParam === "connected") {
      refreshGoogleStatus()
        .then((status) => {
          if (status.connected) {
            toast.success(
              status.email
                ? `Google connected: ${status.email}`
                : "Google account connected"
            );
          } else {
            toast.error("Google connected but status could not be verified");
          }
        })
        .catch(() => toast.error("Failed to refresh Google connection status"));

      router.replace("/dashboard/settings", { scroll: false });
      return;
    }

    if (googleParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(`Google connection failed (${reason})`);
      router.replace("/dashboard/settings", { scroll: false });
    }
  }, [searchParams, refreshGoogleStatus, router]);

  const connectGoogle = async () => {
    const res = await fetch("/api/google/oauth");
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else toast.error("Google OAuth not configured");
  };

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
          targetCompanies: targetCompanies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          gmailSyncEnabled: googleConnected ? gmailSync : false,
          sheetsSyncEnabled: googleConnected ? sheetsSync : false,
          calendarSyncEnabled: googleConnected ? calendarSync : false,
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
            <div className="space-y-2">
              <Label>Target Company Boards (comma-separated slugs)</Label>
              <Input
                value={targetCompanies}
                onChange={(e) => setTargetCompanies(e.target.value)}
                placeholder="openai, stripe, linear, netflix"
              />
              <p className="text-xs text-zinc-500">
                Greenhouse/Lever/Ashby board slugs for job discovery
              </p>
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
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">Google Account</p>
                <p className="text-xs text-zinc-500">
                  {googleConnected
                    ? `Connected${googleEmail ? ` as ${googleEmail}` : ""}`
                    : "Connect for Gmail, Drive, Sheets, and Calendar"}
                </p>
              </div>
              {googleConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connectGoogle}
                  className="gap-1"
                >
                  <Link2 className="h-3 w-3" />
                  Connect
                </Button>
              )}
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={gmailSync}
                disabled={!googleConnected}
                onChange={(e) => setGmailSync(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 disabled:opacity-50"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Gmail sync</p>
                <p className="text-xs text-zinc-500">Import recruiter emails to inbox</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={googleConnected}
                disabled
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 disabled:opacity-50"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Google Drive</p>
                <p className="text-xs text-zinc-500">Store tailored resume PDFs</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sheetsSync}
                disabled={!googleConnected}
                onChange={(e) => setSheetsSync(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 disabled:opacity-50"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Google Sheets sync</p>
                <p className="text-xs text-zinc-500">Export application tracker</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={calendarSync}
                disabled={!googleConnected}
                onChange={(e) => setCalendarSync(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 disabled:opacity-50"
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">Google Calendar sync</p>
                <p className="text-xs text-zinc-500">Sync interview schedule</p>
              </div>
            </label>
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
