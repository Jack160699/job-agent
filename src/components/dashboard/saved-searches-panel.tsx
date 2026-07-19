"use client";

import { useEffect, useState } from "react";
import { Bell, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIndiaDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type AlertFrequency = "OFF" | "DAILY" | "WEEKLY";

interface SavedSearch {
  id: string;
  name: string;
  titles: string[];
  locations: string[];
  sector: string;
  alertFrequency: AlertFrequency;
  alertsEnabled: boolean;
  nextRunAt: string | null;
}

export function SavedSearchesPanel({
  preferencesComplete,
}: {
  preferencesComplete: boolean;
}) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<AlertFrequency>("OFF");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/saved-searches");
    if (!response.ok) return;
    const data = (await response.json()) as { searches?: SavedSearch[] };
    setSearches(data.searches ?? []);
  };

  useEffect(() => {
    let active = true;
    fetch("/api/saved-searches")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { searches?: SavedSearch[] } | null) => {
        if (active && data) setSearches(data.searches ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const saveCurrent = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          alertFrequency: frequency,
          searchStage: "strict",
          alertTypes: [
            "new_high_match",
            "closing_soon",
            "government_deadline",
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save search");
      setName("");
      toast.success(
        frequency === "OFF"
          ? "Search saved."
          : `${frequency === "DAILY" ? "Daily" : "Weekly"} alerts scheduled.`
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save search");
    } finally {
      setSaving(false);
    }
  };

  const updateFrequency = async (id: string, next: AlertFrequency) => {
    const response = await fetch("/api/saved-searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, alertFrequency: next }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || "Could not update alert");
      return;
    }
    toast.success(next === "OFF" ? "Alert paused." : "Alert schedule updated.");
    await load();
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/saved-searches?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Could not delete saved search");
      return;
    }
    setSearches((current) => current.filter((search) => search.id !== id));
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-2">
          <Bell className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">
              Saved searches and alerts
            </p>
            <p className="text-xs text-[var(--ink-tertiary)]">
              Save the current titles, locations, sector, filters, and sources.
              Alerts run on the selected schedule and create in-app recommendations
              for new high matches and closing deadlines.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
          <input
            aria-label="Saved search name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Pune healthcare"
            disabled={!preferencesComplete || saving}
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          <select
            aria-label="Alert frequency"
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as AlertFrequency)
            }
            disabled={!preferencesComplete || saving}
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
          >
            <option value="OFF">No alert</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
          <Button
            type="button"
            className="h-10 gap-1.5"
            disabled={!preferencesComplete || saving || name.trim().length < 2}
            onClick={() => void saveCurrent()}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save search"}
          </Button>
        </div>

        {searches.length > 0 && (
          <div className="divide-y divide-[var(--line)] rounded-[var(--radius-sm)] border border-[var(--line)]">
            {searches.map((search) => (
              <div
                key={search.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">
                    {search.name}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-tertiary)]">
                    {search.titles.join(", ")} · {search.locations.join(", ")} ·{" "}
                    {search.sector.toLowerCase()}
                  </p>
                  {search.nextRunAt && (
                    <p className="mt-0.5 text-[11px] text-[var(--accent)]">
                      Next alert: {formatIndiaDateTime(search.nextRunAt)}
                    </p>
                  )}
                </div>
                <select
                  aria-label={`Alert frequency for ${search.name}`}
                  value={search.alertFrequency}
                  onChange={(event) =>
                    void updateFrequency(
                      search.id,
                      event.target.value as AlertFrequency
                    )
                  }
                  className="h-9 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)]"
                >
                  <option value="OFF">Alert off</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${search.name}`}
                  onClick={() => void remove(search.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
