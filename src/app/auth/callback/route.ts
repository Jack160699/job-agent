import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { getOrCreateUser } from "@/lib/jobs/pipeline";
import prisma from "@/lib/db";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (oauthError) {
    const params = new URLSearchParams({
      error: oauthError,
      ...(errorDescription ? { error_description: errorDescription } : {}),
    });
    return NextResponse.redirect(
      buildRedirectUrl(request, `/login?${params.toString()}`)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildRedirectUrl(request, "/login?error=auth_callback_failed")
    );
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
    return NextResponse.redirect(
      buildRedirectUrl(
        request,
        `/login?error=auth_callback_failed&error_description=${encodeURIComponent(exchangeError.message)}`
      )
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      const dbUser = await getOrCreateUser(user.id, user.email);
      const settings = await prisma.userSettings.findUnique({
        where: { userId: dbUser.id },
      });
      const onboardingDone =
        settings?.onboardingCompletedAt && settings.preferencesComplete;
      const dest = onboardingDone ? next : "/dashboard/onboarding";
      return NextResponse.redirect(buildRedirectUrl(request, dest));
    } catch (err) {
      console.error("[auth/callback] getOrCreateUser failed:", err);
    }
  }

  return NextResponse.redirect(buildRedirectUrl(request, next));
}
