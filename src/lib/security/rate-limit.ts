import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
  keyPrefix?: string;
  userId?: string;
}

const DEFAULT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
const DEFAULT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);

export const RATE_LIMIT_PRESETS = {
  default: { max: DEFAULT_MAX, windowMs: DEFAULT_WINDOW_MS },
  auth: { max: 20, windowMs: 60_000 },
  aiChat: { max: 30, windowMs: 60_000 },
  jobImport: { max: 15, windowMs: 60_000 },
  jobSearch: { max: 10, windowMs: 60_000 },
  resume: { max: 20, windowMs: 60_000 },
  application: { max: 25, windowMs: 60_000 },
  admin: { max: 60, windowMs: 60_000 },
  browserWorker: { max: 40, windowMs: 60_000 },
} as const;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function buildBucketKey(request: NextRequest, options: RateLimitOptions): string {
  const prefix = options.keyPrefix || "global";
  const identity = options.userId || getClientIp(request);
  return `${prefix}:${identity}`;
}

async function checkDurableRateLimit(
  bucketKey: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const windowStart = new Date(now - windowMs);

  try {
    const rows = await prisma.$queryRaw<
      Array<{ request_count: number; window_start: Date; window_ms: number }>
    >`
      SELECT request_count, window_start, window_ms
      FROM rate_limit_buckets
      WHERE bucket_key = ${bucketKey}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row || row.window_start < windowStart) {
      await prisma.$executeRaw`
        INSERT INTO rate_limit_buckets (bucket_key, request_count, window_start, window_ms)
        VALUES (${bucketKey}, 1, ${new Date(now)}, ${windowMs})
        ON CONFLICT (bucket_key)
        DO UPDATE SET
          request_count = 1,
          window_start = ${new Date(now)},
          window_ms = ${windowMs}
      `;
      return { allowed: true, retryAfterSec: 0 };
    }

    if (row.request_count >= max) {
      const resetAt = row.window_start.getTime() + row.window_ms;
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    await prisma.$executeRaw`
      UPDATE rate_limit_buckets
      SET request_count = request_count + 1
      WHERE bucket_key = ${bucketKey}
    `;
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    return checkMemoryRateLimit(bucketKey, max, windowMs);
  }
}

function checkMemoryRateLimit(
  bucketKey: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = memoryStore.get(bucketKey);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  const max = options.max ?? DEFAULT_MAX;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const bucketKey = buildBucketKey(request, options);

  const useDurable =
    process.env.NODE_ENV !== "test" &&
    Boolean(process.env.DATABASE_URL) &&
    process.env.RATE_LIMIT_DURABLE !== "false";

  const result = useDurable
    ? await checkDurableRateLimit(bucketKey, max, windowMs)
    : checkMemoryRateLimit(bucketKey, max, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfterSec: result.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSec),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export function verifyBrowserWorkerSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const token = process.env.BROWSER_WORKER_TOKEN;
  if (!token) return false;
  return authHeader === `Bearer ${token}`;
}
