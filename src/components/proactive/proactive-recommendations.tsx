"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BellOff,
  Check,
  Clock,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  type: string;
  category: string;
  priority: "low" | "medium" | "high";
  title: string;
  body: string;
  reason: string;
  evidence: Array<{ label: string; value: string | number }> | null;
  suggestedAction: string | null;
  actionUrl: string | null;
  createdAt: string;
}

interface RecommendationSettings {
  notificationsEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  proactiveFrequencyHours: number;
  disabledRecommendationCategories: string[];
  dailyDigestEnabled: boolean;
  weeklyReportEnabled: boolean;
}

export function ProactiveRecommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [settings, setSettings] = useState<RecommendationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showControls, setShowControls] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Recommendations could not be loaded.");
      }
      setItems(data.recommendations ?? []);
      setSettings(data.settings ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Recommendations could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const act = async (
    payload:
      | { id: string; action: "dismiss" | "done" }
      | { id: string; action: "snooze"; hours: number }
      | { action: "disable_category"; category: string }
      | {
          action: "configure";
          dailyDigestEnabled?: boolean;
          weeklyReportEnabled?: boolean;
          notificationsEnabled?: boolean;
        }
  ) => {
    const itemId = "id" in payload ? payload.id : null;
    setPendingId(itemId ?? payload.action);
    try {
      const response = await fetch("/api/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");

      if (itemId) {
        setItems((previous) => previous.filter((item) => item.id !== itemId));
      } else if (payload.action === "disable_category") {
        setItems((previous) =>
          previous.filter((item) => item.category !== payload.category)
        );
        setSettings((previous) =>
          previous
            ? {
                ...previous,
                disabledRecommendationCategories: [
                  ...new Set([
                    ...previous.disabledRecommendationCategories,
                    payload.category,
                  ]),
                ],
              }
            : previous
        );
      } else if (payload.action === "configure") {
        setSettings((previous) =>
          previous ? { ...previous, ...payload } : previous
        );
      }
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Recommendation update failed."
      );
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--ink-secondary)]"
        aria-live="polite"
      >
        Checking for useful next steps…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
        <p className="text-sm text-[var(--ink-secondary)]">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0 && !showControls) return null;

  return (
    <section className="space-y-2" aria-label="Kairela recommendations">
      <div className="flex items-center justify-between gap-3">
        {items.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold">Recommended next steps</h2>
            <p className="text-xs text-[var(--ink-tertiary)]">
              Based on your current Kairela activity
            </p>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setShowControls((current) => !current)}
          aria-expanded={showControls}
        >
          <Settings2 className="mr-1 h-3.5 w-3.5" />
          Controls
        </Button>
      </div>

      {showControls && settings && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium">Recommendation preferences</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pendingId === "configure"}
              onClick={() =>
                void act({
                  action: "configure",
                  notificationsEnabled: !settings.notificationsEnabled,
                })
              }
            >
              {settings.notificationsEnabled ? "Pause recommendations" : "Resume recommendations"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={settings.dailyDigestEnabled ? "default" : "outline"}
              disabled={pendingId === "configure"}
              onClick={() =>
                void act({
                  action: "configure",
                  dailyDigestEnabled: !settings.dailyDigestEnabled,
                })
              }
            >
              Daily digest
            </Button>
            <Button
              type="button"
              size="sm"
              variant={settings.weeklyReportEnabled ? "default" : "outline"}
              disabled={pendingId === "configure"}
              onClick={() =>
                void act({
                  action: "configure",
                  weeklyReportEnabled: !settings.weeklyReportEnabled,
                })
              }
            >
              Weekly report
            </Button>
          </div>
          {settings.disabledRecommendationCategories.length > 0 && (
            <p className="mt-3 text-xs text-[var(--ink-tertiary)]">
              Disabled categories:{" "}
              {settings.disabledRecommendationCategories.join(", ")}. Re-enable
              them from Settings.
            </p>
          )}
        </div>
      )}

      {items.map((rec) => (
        <div
          key={rec.id}
          className={cn(
            "rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{rec.title}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    rec.priority === "high"
                      ? "bg-[var(--danger-muted)] text-[var(--danger)]"
                      : "bg-[var(--accent-muted)] text-[var(--ink-secondary)]"
                  )}
                >
                  {rec.priority}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">{rec.body}</p>
              <p className="mt-2 text-xs text-[var(--ink-tertiary)]">
                Why: {rec.reason}
              </p>
              {rec.evidence && rec.evidence.length > 0 && (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-tertiary)]">
                  {rec.evidence.map((entry) => (
                    <div key={entry.label} className="flex gap-1">
                      <dt>{entry.label}:</dt>
                      <dd className="font-medium text-[var(--ink-secondary)]">
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={pendingId === rec.id}
              onClick={() => void act({ id: rec.id, action: "dismiss" })}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {rec.actionUrl && (
              <Button asChild size="sm" className="h-9">
                <Link href={rec.actionUrl}>Take action</Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1"
              disabled={pendingId === rec.id}
              onClick={() =>
                void act({ id: rec.id, action: "snooze", hours: 24 })
              }
            >
              <Clock className="h-3 w-3" />
              Snooze 24h
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1"
              disabled={pendingId === rec.id}
              onClick={() => void act({ id: rec.id, action: "done" })}
            >
              <Check className="h-3 w-3" />
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 gap-1"
              disabled={pendingId === "disable_category"}
              onClick={() =>
                void act({
                  action: "disable_category",
                  category: rec.category,
                })
              }
            >
              <BellOff className="h-3 w-3" />
              Hide {rec.category}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
