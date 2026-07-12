import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthClient,
  storeGoogleTokens,
  syncIntegrationFlags,
  type GoogleIntegrationFeature,
} from "@/lib/google/oauth";
import { verifyGmailProfile } from "@/lib/google/verify";
import { getAppBaseUrl } from "@/lib/brand/urls";
import prisma from "@/lib/db";

function parseState(state: string): {
  userId: string;
  features: GoogleIntegrationFeature[];
} | null {
  try {
    const json = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (json.userId && Array.isArray(json.features)) return json;
    return { userId: state, features: ["gmail", "sheets", "calendar"] };
  } catch {
    return { userId: state, features: ["gmail"] };
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const appUrl = getAppBaseUrl();

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=missing_params`);
  }

  const parsed = parseState(stateRaw);
  if (!parsed) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=invalid_state`);
  }

  const { userId, features } = parsed;
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

    await storeGoogleTokens(userId, tokens, features);
    await syncIntegrationFlags(userId, features);

    if (features.includes("gmail")) {
      const email = await verifyGmailProfile(userId);
      if (!email) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=gmail_verify`);
      }
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=error&reason=exchange_failed`);
  }
}
