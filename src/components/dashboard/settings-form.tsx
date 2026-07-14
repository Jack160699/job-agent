"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Link2, CheckCircle2, RefreshCw, Unplug } from "lucide-react";

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
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  proactiveFrequencyHours?: number;
  disabledRecommendationCategories?: string[];
  dailyDigestEnabled?: boolean;
  weeklyReportEnabled?: boolean;
  gmailSyncEnabled: boolean;
  sheetsSyncEnabled: boolean;
  calendarSyncEnabled: boolean;
  targetCompanies?: string[];
}

type GoogleStatus = {
  connected: boolean;
  health?: string;
  email: string | null;
  grantedFeatures?: string[];
  integrations: {
    gmail: boolean;
    drive: boolean;
    sheets: boolean;
    calendar: boolean;
  };
};

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Google did not return the required connection details.",
  session_required: "Sign in again, then reconnect Google.",
  session_mismatch: "That Google connection belonged to a different session.",
  invalid_features: "Choose at least one Google integration before connecting.",
  no_tokens: "Google did not issue usable credentials. Try again.",
  gmail_verify: "Gmail access could not be verified. Reconnect and approve Gmail.",
  exchange_failed: "Google connection failed during token exchange.",
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
    initialSettings?.jobTitles?.join(", ") || ""
  );
  const [locations, setLocations] = useState(
    initialSettings?.locations?.join(", ") || ""
  );
  const [experienceYears, setExperienceYears] = useState(
    initialSettings?.experienceYears?.toString() || ""
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
    initialSettings?.targetCompanies?.join(", ") || ""
  );
  const [googleBusy, setGoogleBusy] = useState<string | null>(null);
  const [gmailSync, setGmailSync] = useState(
    initialSettings?.gmailSyncEnabled ?? false
  );
  const [sheetsSync, setSheetsSync] = useState(
    initialSettings?.sheetsSyncEnabled ?? false
  );
  const [calendarSync, setCalendarSync] = useState(
    initialSettings?.calendarSyncEnabled ?? false
  );
  const [driveSync, setDriveSync] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialSettings?.notificationsEnabled ?? true
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    initialSettings?.quietHoursStart ?? "22:00"
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    initialSettings?.quietHoursEnd ?? "08:00"
  );
  const [proactiveFrequencyHours, setProactiveFrequencyHours] = useState(
    initialSettings?.proactiveFrequencyHours?.toString() ?? "24"
  );
  const [disabledRecommendationCategories, setDisabledCategories] = useState(
    initialSettings?.disabledRecommendationCategories ?? []
  );
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(
    initialSettings?.dailyDigestEnabled ?? false
  );
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(
    initialSettings?.weeklyReportEnabled ?? true
  );

  const applyGoogleStatus = useCallback((status: GoogleStatus) => {
    setGoogleConnected(status.connected);
    setGoogleEmail(status.email);
    if (status.connected) {
      setGmailSync(status.integrations.gmail);
      setSheetsSync(status.integrations.sheets);
      setCalendarSync(status.integrations.calendar);
      setDriveSync(status.integrations.drive);
    }
  }, []);

  const refreshGoogleStatus = useCallback(async () => {
    const res = await fetch("/api/google/status");
    const data = (await res.json()) as GoogleStatus;
    applyGoogleStatus(data);
    return data;
  }, [applyGoogleStatus]);

  useEffect(() => {
    queueMicrotask(() => void refreshGoogleStatus().catch(() => {}));
  }, [refreshGoogleStatus]);

  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (!googleParam) return;

    if (googleParam === "connected") {
      queueMicrotask(() => {
        void refreshGoogleStatus()
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
      });
      return;
    }

    if (googleParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(
        GOOGLE_ERROR_MESSAGES[reason] ||
          `Google connection failed. Please try again (${reason}).`
      );
      router.replace("/dashboard/settings", { scroll: false });
    }
  }, [searchParams, refreshGoogleStatus, router]);

  const selectedGoogleFeatures = () => {
    const features: string[] = [];
    if (gmailSync) features.push("gmail");
    if (sheetsSync) features.push("sheets");
    if (calendarSync) features.push("calendar");
    if (driveSync) features.push("drive");
    return features;
  };

  const connectGoogle = async () => {
    const features = selectedGoogleFeatures();
    if (features.length === 0) {
      toast.error("Select at least one Google integration before connecting");
      return;
    }
    setGoogleBusy("connect");
    try {
      const res = await fetch(`/api/google/oauth?scopes=${features.join(",")}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error || "Google OAuth not configured");
    } finally {
      setGoogleBusy(null);
    }
  };

  const disconnectGoogle = async () => {
    setGoogleBusy("disconnect");
    try {
      const res = await fetch("/api/google/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      setGoogleConnected(false);
      setGoogleEmail(null);
      setGmailSync(false);
      setSheetsSync(false);
      setCalendarSync(false);
      setDriveSync(false);
      toast.success("Google disconnected and provider access revoked when possible");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Disconnect failed");
    } finally {
      setGoogleBusy(null);
    }
  };

  const verifyGoogle = async () => {
    setGoogleBusy("verify");
    try {
      const res = await fetch("/api/google/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success("Google integrations verified");
      await refreshGoogleStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setGoogleBusy(null);
    }
  };

  const syncGoogle = async () => {
    setGoogleBusy("sync");
    try {
      const res = await fetch("/api/google/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          gmail: gmailSync,
          sheets: sheetsSync,
          calendar: calendarSync,
          drive: driveSync,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success("Google sync completed for enabled integrations");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setGoogleBusy(null);
    }
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
          driveBackupEnabled: googleConnected ? driveSync : false,
          notificationsEnabled,
          quietHoursStart: notificationsEnabled ? quietHoursStart : null,
          quietHoursEnd: notificationsEnabled ? quietHoursEnd : null,
          proactiveFrequencyHours:
            parseInt(proactiveFrequencyHours, 10) || 24,
          disabledRecommendationCategories,
          dailyDigestEnabled,
          weeklyReportEnabled,
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
        <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
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
                placeholder="Optional: openai, stripe, linear"
              />
              <p className="text-xs text-[var(--ink-tertiary)]">
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
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Require review before submission
                </p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Pause for your approval before final application submit
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={autoSubmit}
                onChange={(e) => setAutoSubmit(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Allow one-click submit after review (Greenhouse, Lever, Ashby)
                </p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Still requires explicit confirmation per application. Scheduled agent runs never submit.
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="recommendations">
        <Card>
          <CardHeader>
            <CardTitle>Career recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(event) =>
                  setNotificationsEnabled(event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Show grounded recommendations
                </p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Kairela uses your profile and activity, without manufactured
                  urgency or guaranteed outcomes.
                </p>
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quiet-hours-start">Quiet hours start</Label>
                <Input
                  id="quiet-hours-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(event) => setQuietHoursStart(event.target.value)}
                  disabled={!notificationsEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-hours-end">Quiet hours end</Label>
                <Input
                  id="quiet-hours-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(event) => setQuietHoursEnd(event.target.value)}
                  disabled={!notificationsEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recommendation-frequency">
                  Minimum interval (hours)
                </Label>
                <Input
                  id="recommendation-frequency"
                  type="number"
                  min="6"
                  max="168"
                  value={proactiveFrequencyHours}
                  onChange={(event) =>
                    setProactiveFrequencyHours(event.target.value)
                  }
                  disabled={!notificationsEnabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dailyDigestEnabled}
                  onChange={(event) =>
                    setDailyDigestEnabled(event.target.checked)
                  }
                />
                Daily digest
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={weeklyReportEnabled}
                  onChange={(event) =>
                    setWeeklyReportEnabled(event.target.checked)
                  }
                />
                Weekly career report
              </label>
            </div>

            {disabledRecommendationCategories.length > 0 && (
              <div className="rounded-lg border border-[var(--line)] p-3">
                <p className="text-sm font-medium">Hidden categories</p>
                <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                  {disabledRecommendationCategories.join(", ")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setDisabledCategories([])}
                >
                  Re-enable all categories
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="integrations">
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Google Account</p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  {googleConnected
                    ? `Connected${googleEmail ? ` as ${googleEmail}` : ""}`
                    : "Select the integrations below, then connect your Google account"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {googleConnected ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={verifyGoogle}
                      disabled={googleBusy != null}
                      className="gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Verify
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncGoogle}
                      disabled={googleBusy != null}
                      className="gap-1"
                    >
                      Sync now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnectGoogle}
                      disabled={googleBusy != null}
                      className="gap-1"
                    >
                      <Unplug className="h-3 w-3" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={connectGoogle}
                    disabled={googleBusy != null}
                    className="gap-1"
                  >
                    <Link2 className="h-3 w-3" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-[var(--ink-tertiary)]">
              Choose scopes before connecting. You can reconnect later to add more Google products.
            </p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={gmailSync}
                onChange={(e) => setGmailSync(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Gmail sync</p>
                <p className="text-xs text-[var(--ink-tertiary)]">Import recruiter emails to inbox</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={driveSync}
                onChange={(e) => setDriveSync(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Google Drive</p>
                <p className="text-xs text-[var(--ink-tertiary)]">Store tailored resume PDFs</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sheetsSync}
                onChange={(e) => setSheetsSync(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Google Sheets sync</p>
                <p className="text-xs text-[var(--ink-tertiary)]">Export application tracker</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={calendarSync}
                onChange={(e) => setCalendarSync(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">Google Calendar sync</p>
                <p className="text-xs text-[var(--ink-tertiary)]">Sync interview schedule</p>
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
