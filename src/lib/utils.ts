import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatIndiaDateTime(date: Date | string): string {
  const instant = new Date(date);
  if (Number.isNaN(instant.getTime())) return "Unknown";

  const indiaTime = new Date(instant.getTime() + 330 * 60 * 1000);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(indiaTime.getUTCDate())}/${pad(
    indiaTime.getUTCMonth() + 1
  )}/${indiaTime.getUTCFullYear()}, ${pad(indiaTime.getUTCHours())}:${pad(
    indiaTime.getUTCMinutes()
  )} IST`;
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function getMatchScoreColor(score: number): string {
  if (score >= 80) return "text-[var(--success)]";
  if (score >= 60) return "text-[var(--warning)]";
  return "text-[var(--error)]";
}

export function getMatchScoreBg(score: number): string {
  if (score >= 80) return "bg-[var(--success-muted)] border-[var(--success)]/20 text-[var(--success)]";
  if (score >= 60) return "bg-[var(--warning-muted)] border-[var(--warning)]/20 text-[var(--warning)]";
  return "bg-[var(--error-muted)] border-[var(--error)]/20 text-[var(--error)]";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
