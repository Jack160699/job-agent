"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  type: string;
  title: string;
  body: string;
  reason: string;
  actionUrl: string | null;
}

export function ProactiveRecommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);

  const load = () => {
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((d) => setItems(d.recommendations ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: "dismiss" | "snooze") => {
    await fetch("/api/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, hours: 24 }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((rec) => (
        <div
          key={rec.id}
          className={cn(
            "rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] p-4"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{rec.title}</p>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">{rec.body}</p>
              <p className="mt-2 text-xs text-[var(--ink-tertiary)]">
                Why: {rec.reason}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => act(rec.id, "dismiss")}
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
              onClick={() => act(rec.id, "snooze")}
            >
              <Clock className="h-3 w-3" />
              Snooze 24h
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
