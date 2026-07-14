import { NextRequest, NextResponse } from "next/server";
import {
  disconnectGoogle,
  getGoogleOAuthClient,
  storeGoogleTokens,
  syncIntegrationFlags,
  type GoogleIntegrationFeature,
  type GoogleTokenBundle,
  parseGoogleFeatures,
} from "@/lib/google/oauth";
import { verifyGmailProfile } from "@/lib/google/verify";
import { getAppBaseUrl } from "@/lib/brand/urls";
import { getDbUser } from "@/lib/auth/server";
import { verifySignedOAuthState } from "@/lib/security/oauth-state";
import prisma from "@/lib/db";

function redirectWithReason(appUrl: string, reason: string) {
  return NextResponse.redirect(
    `${appUrl}/dashboard/settings?google=error&reason=${encodeURIComponent(reason)}`
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const appUrl = getAppBaseUrl();

  if (!code || !stateRaw) {
    return redirectWithReason(appUrl, "missing_params");
  }

  const verified = verifySignedOAuthState(stateRaw);
  if (!verified.ok) {
    console.warn("[google/callback] OAuth state rejected:", verified.reason);
    return redirectWithReason(appUrl, `invalid_state_${verified.reason}`);
  }

  const sessionUser = await getDbUser();
  if (!sessionUser) {
    return redirectWithReason(appUrl, "session_required");
  }

  const { userId, features } = verified.payload;
  if (sessionUser.id !== userId) {
    console.warn("[google/callback] OAuth state user mismatch");
    return redirectWithReason(appUrl, "session_mismatch");
  }

  let allowedFeatures: GoogleIntegrationFeature[];
  try {
    allowedFeatures = parseGoogleFeatures(features);
  } catch {
    return redirectWithReason(appUrl, "invalid_features");
  }
  if (allowedFeatures.length === 0) {
    return redirectWithReason(appUrl, "invalid_features");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return redirectWithReason(appUrl, "invalid_user");
  }

  try {
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token && !tokens.refresh_token) {
      return redirectWithReason(appUrl, "no_tokens");
    }

    const stored = await storeGoogleTokens(
      userId,
      tokens as GoogleTokenBundle,
      allowedFeatures,
      { mergeExisting: true }
    );
    await syncIntegrationFlags(userId, stored.features, {
      disableMissing: false,
    });

    if (stored.features.includes("gmail")) {
      const email = await verifyGmailProfile(userId);
      if (!email) {
        await disconnectGoogle(userId);
        await syncIntegrationFlags(userId, [], { disableMissing: true });
        return redirectWithReason(appUrl, "gmail_verify");
      }
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return redirectWithReason(appUrl, "exchange_failed");
  }
}
