const PLACEHOLDER_PATTERNS = [
  "placeholder",
  "your-project",
  "your-anon-key",
  "your-service-role-key",
  "[password]",
  "[project]",
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isPlaceholder(value)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing or contains a placeholder value"
    );
  }
  return value!;
}

export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isPlaceholder(value)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or contains a placeholder value"
    );
  }
  return value!;
}

export function getSupabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isPlaceholder(value)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing or contains a placeholder value"
    );
  }
  return value!;
}

export function isSupabaseConfigured(): boolean {
  try {
    getSupabaseUrl();
    getSupabaseAnonKey();
    return true;
  } catch {
    return false;
  }
}
