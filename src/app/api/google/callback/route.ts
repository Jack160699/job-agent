import { NextRequest, NextResponse } from "next/server";
import {
  enableGoogleIntegrations,
  getGoogleOAuthClient,
  storeGoogleTokens,
} from "@/lib/google/oauth";
import { verifyGmailProfile } from "@/lib/google/verify";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const userId = request.nextUrl.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=missing_params`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=invalid_user`);
  }

  try {
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token && !tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=no_tokens`);
    }

    await storeGoogleTokens(userId, tokens);
    await enableGoogleIntegrations(userId);

    const email = await verifyGmailProfile(userId);
    if (!email) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=gmail_verify`);
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=exchange_failed`);
  }
}
