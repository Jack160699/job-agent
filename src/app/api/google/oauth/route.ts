import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser } from "@/lib/api/auth";
import {
  getAuthUrl,
  type GoogleIntegrationFeature,
} from "@/lib/google/oauth";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    ...RATE_LIMIT_PRESETS.auth,
    keyPrefix: "google-oauth",
  });
  if (limited) return limited;

  try {
    const user = await resolveApiUser();
    const scopesParam = request.nextUrl.searchParams.get("scopes") || "gmail";
    const features = scopesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as GoogleIntegrationFeature[];

    const url = getAuthUrl(user.id, features);
    return NextResponse.json({ url, features });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
