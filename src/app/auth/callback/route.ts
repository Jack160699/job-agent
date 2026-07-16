import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { resolveKairelaUser } from "@/lib/auth/resolve-user";
import { isSafeInternalRedirect } from "@/lib/security/oauth-state";
import prisma from "@/lib/db";
import type { EmailOtpType } from "@supabase/supabase-js";
import { postAuthDestination } from "@/lib/auth/redirect-policy";
import { classifyAuthError, sanitizeProviderParam } from "@/lib/auth/provider-errors";
import { createAuditLog } from "@/lib/audit";

function buildRedirectUrl(request: Request, path: string): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (process.env.NODE_ENV === "development") {
    return `${origin}${path}`;
  }
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  return `${origin}${path}`;
}

function failedLoginRedirect(
  request: Request,
  provider: ReturnType<typeof sanitizeProviderParam>
): string {
  const params = new URLSearchParams({ error: "auth_callback_failed" });
  if (provider) params.set("provider", provider);
  return buildRedirectUrl(request, `/login?${params.toString()}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = isSafeInternalRedirect(nextParam) ? nextParam : "/dashboard";
  const oauthError = searchParams.get("error");
  // Cosmetic only — chooses which provider-specific copy to show. Never
  // trusted for anything security-relevant; the real provider (once known)
  // comes from the authenticated Supabase user's own app_metadata below.
  const providerHint = sanitizeProviderParam(searchParams.get("provider"));

  if (oauthError) {
    console.error("[auth/callback] provider returned an error", {
      provider: providerHint,
      category: classifyAuthError(searchParams.get("error_description")),
    });
    return NextResponse.redirect(failedLoginRedirect(request, providerHint));
  }

  if (!code && !(tokenHash && otpType)) {
    return NextResponse.redirect(failedLoginRedirect(request, providerHint));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const { error: exchangeError } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: otpType!,
      });

  if (exchangeError) {
    console.error("[auth/callback] token exchange failed", {
      provider: providerHint,
      category: classifyAuthError(exchangeError.message),
    });
    return NextResponse.redirect(failedLoginRedirect(request, providerHint));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(failedLoginRedirect(request, providerHint));
  }

  const resolvedProvider =
    sanitizeProviderParam(user.app_metadata?.provider as string | undefined) ?? providerHint;

  try {
    const resolution = await resolveKairelaUser(user);

    if (resolution.status === "email_missing" || resolution.status === "email_unverified_conflict") {
      const params = new URLSearchParams({ next });
      return NextResponse.redirect(
        buildRedirectUrl(request, `/auth/complete-email?${params.toString()}`)
      );
    }

    if (resolvedProvider === "linkedin_oidc") {
      await createAuditLog({
        userId: resolution.user.id,
        level: "INFO",
        action: "analytics:linkedin_auth_succeeded",
        resource: "auth",
        message: "linkedin_auth_succeeded",
        metadata: { provider: "linkedin_oidc" },
      });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: resolution.user.id },
    });
    const onboardingDone = Boolean(
      settings?.onboardingCompletedAt && settings.preferencesComplete
    );
    const dest = postAuthDestination({ next, onboardingComplete: onboardingDone });
    return NextResponse.redirect(buildRedirectUrl(request, dest));
  } catch (err) {
    console.error("[auth/callback] user resolution failed", {
      provider: resolvedProvider,
      category: classifyAuthError(err instanceof Error ? err.message : null),
    });
    return NextResponse.redirect(failedLoginRedirect(request, resolvedProvider));
  }
}
