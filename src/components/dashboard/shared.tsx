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
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-full)] border font-semibold tabular-nums",
        getMatchScoreBg(score),
        sizeClasses[size]
      )}
    >
      {showLabel && <span className="opacity-70 font-normal">Match</span>}
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

/** Compact metric tile — Ramp/Mercury density */
export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">
          {title}
        </p>
        {icon && <div className="text-[var(--ink-tertiary)] [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</div>}
      </div>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--ink)] leading-tight">
        {value}
      </p>
      {description && (
        <p className="mt-0.5 text-[10px] text-[var(--ink-tertiary)]">{description}</p>
      )}
      {trend && (
        <p
          className={cn(
            "mt-1 text-[10px] font-medium",
            trend.positive ? "text-[var(--success)]" : "text-[var(--error)]"
          )}
        >
          {trend.positive ? "+" : ""}
          {trend.value}% vs last week
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
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-sunken)] text-[var(--ink-tertiary)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-1 max-w-xs text-xs text-[var(--ink-tertiary)]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DISCOVERED: "bg-blue-50 text-blue-700 border-blue-200",
    ANALYZED: "bg-cyan-50 text-cyan-700 border-cyan-200",
    MATCHED: "bg-[var(--success-muted)] text-[var(--success)] border-green-200",
    SKIPPED: "bg-[var(--surface-sunken)] text-[var(--ink-tertiary)] border-[var(--line)]",
    PENDING_REVIEW: "bg-[var(--warning-muted)] text-[var(--warning)] border-amber-200",
    SUBMITTED: "bg-[var(--accent-muted)] text-[var(--accent)] border-teal-200",
    FAILED: "bg-[var(--error-muted)] text-[var(--error)] border-red-200",
    INTERVIEWING: "bg-purple-50 text-purple-700 border-purple-200",
    OFFERED: "bg-[var(--success-muted)] text-[var(--success)] border-green-200",
    REJECTED: "bg-[var(--error-muted)] text-[var(--error)] border-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-[var(--radius-full)] border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        colors[status] || "bg-[var(--surface-sunken)] text-[var(--ink-tertiary)] border-[var(--line)]"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
