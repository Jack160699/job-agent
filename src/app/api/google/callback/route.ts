import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient, storeGoogleTokens } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const userId = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error`);
  }

  try {
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
    await storeGoogleTokens(userId, tokens);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error`);
  }
}
