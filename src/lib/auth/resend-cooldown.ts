const COOLDOWN_MS = 60_000;

const lastResendByEmail = new Map<string, number>();

export function canResendVerification(email: string): {
  allowed: boolean;
  waitSeconds?: number;
} {
  const key = email.toLowerCase().trim();
  const last = lastResendByEmail.get(key);
  if (!last) return { allowed: true };

  const elapsed = Date.now() - last;
  if (elapsed >= COOLDOWN_MS) return { allowed: true };

  return {
    allowed: false,
    waitSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
  };
}

export function recordResendVerification(email: string): void {
  lastResendByEmail.set(email.toLowerCase().trim(), Date.now());
}
