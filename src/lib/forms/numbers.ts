export function parseOptionalInteger(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseNumberOrFallback(
  value: string,
  fallback: number
): number {
  const normalized = value.trim();
  if (!normalized) return fallback;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}
