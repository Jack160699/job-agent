"use client";

import { cn, getMatchScoreBg, getMatchScoreColor } from "@/lib/utils";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function MatchScoreBadge({
  score,
  size = "md",
  showLabel = true,
}: MatchScoreBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        getMatchScoreBg(score),
        getMatchScoreColor(score),
        sizeClasses[size]
      )}
    >
      {showLabel && <span className="opacity-70">Match</span>}
      {Math.round(score)}%
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-bold text-zinc-100">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      )}
      {trend && (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            trend.positive ? "text-emerald-400" : "text-red-400"
          )}
        >
          {trend.positive ? "+" : ""}
          {trend.value}% from last week
        </p>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 rounded-full bg-zinc-800 p-4 text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-200">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500",
        className
      )}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DISCOVERED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ANALYZED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    MATCHED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    SKIPPED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    PENDING_REVIEW: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    SUBMITTED: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
    INTERVIEWING: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    OFFERED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        colors[status] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
