export async function withResilience<T>(
  fn: () => Promise<T>,
  options: {
    label: string;
    retries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
  }
): Promise<T> {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await options.onRetry?.(attempt, error);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }

  throw new Error(
    `[${options.label}] failed after ${retries} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

export function findElementWithFallbacks(
  snapshot: { elements: Array<{ ref: string; role: string; name: string; tag?: string; type?: string }> },
  patterns: RegExp[],
  fallbacks: RegExp[] = []
) {
  // Match against the accessible name only. Role/tag must never expand name matching,
  // or every textbox would match `/input/i` / `/textbox/i` fallbacks.
  const allPatterns = [...patterns, ...fallbacks];
  return snapshot.elements.find((el) =>
    allPatterns.some((p) => p.test(el.name))
  );
}
