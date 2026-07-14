import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStatePayload {
  userId: string;
  features: string[];
  nonce: string;
  exp: number;
}

export type OAuthStateFailureReason =
  | "malformed"
  | "invalid_signature"
  | "expired"
  | "replay"
  | "invalid_payload";

const usedNonces = new Map<string, number>();

function pruneNonces(now: number) {
  for (const [nonce, exp] of usedNonces) {
    if (exp <= now) usedNonces.delete(nonce);
  }
}

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET or ENCRYPTION_KEY is required for OAuth state");
  }
  return secret;
}

export function createSignedOAuthState(input: {
  userId: string;
  features: string[];
}): string {
  const payload: OAuthStatePayload = {
    userId: input.userId,
    features: input.features,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifySignedOAuthState(
  token: string,
  options?: { consumeNonce?: boolean }
): { ok: true; payload: OAuthStatePayload } | { ok: false; reason: OAuthStateFailureReason } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "malformed" };
  }

  const [data, signature] = parts;
  const expected = createHmac("sha256", getStateSecret()).update(data).digest("base64url");

  try {
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: false, reason: "invalid_signature" };
    }
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    !payload.userId ||
    typeof payload.userId !== "string" ||
    !payload.nonce ||
    typeof payload.nonce !== "string" ||
    !payload.exp ||
    !Array.isArray(payload.features)
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  const now = Date.now();
  pruneNonces(now);
  if (usedNonces.has(payload.nonce)) {
    return { ok: false, reason: "replay" };
  }

  if (options?.consumeNonce !== false) {
    usedNonces.set(payload.nonce, payload.exp);
  }

  return { ok: true, payload };
}

export function isSafeInternalRedirect(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  if (path.includes("\\")) return false;
  return true;
}
