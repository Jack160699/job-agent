import { NextRequest, NextResponse } from "next/server";
import { resolveApiUser } from "@/lib/api/auth";
import {
  getAuthUrl,
  parseGoogleFeatures,
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
    const features = parseGoogleFeatures(
      scopesParam.split(",").map((s) => s.trim()).filter(Boolean)
    );

    const url = await getAuthUrl(user.id, features);
    return NextResponse.json({ url, features });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("Invalid Google integration")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
