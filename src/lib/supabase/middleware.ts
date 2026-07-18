import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isUserEmailVerified } from "@/lib/auth/verify";
import { shouldRedirectWwwToApex } from "@/lib/brand/urls";
import { BRAND } from "@/lib/brand";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";
import { shouldRedirectAuthenticatedAuthPage } from "@/lib/auth/redirect-policy";

export async function updateSession(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (shouldRedirectWwwToApex(host)) {
    const url = request.nextUrl.clone();
    url.host = BRAND.domain;
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  // Injected into the downstream *request* headers (not the response) so
  // Server Components can actually read it via next/headers' headers() —
  // setting it only on the outgoing response would just add an HTTP header
  // for the browser and never reach server-side rendering at all.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/verify-email") ||
    request.nextUrl.pathname.startsWith("/auth/");
  const isPublicPage =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/api/health");

  if (
    !user &&
    !isAuthPage &&
    !isPublicPage &&
    request.nextUrl.pathname.startsWith("/dashboard")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Block unverified email/password users from dashboard (OAuth users are verified at IdP)
  if (
    user &&
    !isUserEmailVerified(user) &&
    request.nextUrl.pathname.startsWith("/dashboard")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.searchParams.set("email", user.email || "");
    return NextResponse.redirect(url);
  }

  if (
    user &&
    isUserEmailVerified(user) &&
    isAuthPage &&
    shouldRedirectAuthenticatedAuthPage(request.nextUrl.pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
