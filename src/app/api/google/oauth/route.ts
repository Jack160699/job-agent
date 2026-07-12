import { NextRequest, NextResponse } from "next/server";
import { resolveApiUserDev } from "@/lib/api/auth";
import {
  getAuthUrl,
  type GoogleIntegrationFeature,
} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveApiUserDev();
    const scopesParam = request.nextUrl.searchParams.get("scopes") || "gmail";
    const features = scopesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as GoogleIntegrationFeature[];

    const url = getAuthUrl(user.id, features);
    return NextResponse.json({ url, features });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
