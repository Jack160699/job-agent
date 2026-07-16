import type { CSSProperties } from "react";

/**
 * Design tokens scoped to the resume-first onboarding flow only. These are
 * plain CSS custom properties applied to a wrapper element — they do not
 * touch globals.css or any token used elsewhere in the app. The full
 * site-wide white/blue redesign is a separate, later phase.
 */
export const RESUME_FIRST_TOKENS: CSSProperties = {
  ["--rf-bg" as string]: "#ffffff",
  ["--rf-surface" as string]: "#f2f6ff",
  ["--rf-surface-strong" as string]: "#e6edff",
  ["--rf-primary" as string]: "#2455e6",
  ["--rf-primary-hover" as string]: "#1d46c4",
  ["--rf-primary-muted" as string]: "#e8eefd",
  ["--rf-ink" as string]: "#0b1530",
  ["--rf-ink-secondary" as string]: "#44507a",
  ["--rf-ink-tertiary" as string]: "#7480a6",
  ["--rf-line" as string]: "#d6e0fb",
  ["--rf-line-strong" as string]: "#b7c8f7",
  ["--rf-success" as string]: "#0f8a5f",
  ["--rf-warning" as string]: "#a15c00",
  ["--rf-radius" as string]: "14px",
  ["--rf-radius-sm" as string]: "10px",
};
