"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AuthLayout, AuthDivider } from "@/components/auth/auth-layout";
import { BRAND } from "@/lib/brand";
import { SocialAuthButton } from "@/components/auth/social-auth-button";
import { ErrorCallout } from "@/components/ui/error-callout";
import { createClient } from "@/lib/supabase/client";
import { isUserEmailVerified } from "@/lib/auth/verify";
import { sanitizeProviderParam, providerAuthFailedMessage } from "@/lib/auth/provider-errors";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { toast } from "sonner";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const callbackProvider = sanitizeProviderParam(searchParams.get("provider"));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("email not confirmed")) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(signInError.message);
        return;
      }

      if (data.user && !isUserEmailVerified(data.user)) {
        await supabase.auth.signOut();
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      toast.success("Welcome back!");
      // A plain client-side router.push("/dashboard") was found (via live
      // Preview verification, reproduced twice) to get stuck when the
      // destination layout itself issues a server-side redirect() (new
      // users get redirect()'d from /dashboard to /dashboard/onboarding):
      // the URL bar updates all the way to the final destination, but the
      // client Router Cache/RSC transition never commits any content —
      // the browser is left retrying the same cached RSC fetch forever,
      // and only a hard reload renders anything. A full navigation sends
      // a real HTTP request and always renders correctly, so it's used
      // here instead of the client-side transition for this one-time,
      // non-performance-critical post-login hop.
      window.location.href = "/dashboard";
    } catch {
      setError("Failed to sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" description={`Sign in to your ${BRAND.name} account`}>
      <Card>
        <CardContent className="p-6">
          {callbackError && (
            <ErrorCallout
              className="mb-6"
              title="Sign in failed"
              what={providerAuthFailedMessage(callbackProvider)}
              why="The OAuth callback returned an error or expired."
              fix="Try signing in again, or use email and password."
            />
          )}

          <div className="space-y-2">
            <SocialAuthButton provider="google" mode="signin" className="h-11 w-full" />
            <SocialAuthButton provider="linkedin_oidc" mode="signin" className="h-11 w-full" />
          </div>
          {FEATURE_FLAGS.linkedinAuth && (
            <p className="mt-3 text-center text-xs text-[var(--ink-tertiary)]">
              LinkedIn is used for sign-in and basic account details. Your resume remains the
              source for career history and skills.
            </p>
          )}

          <AuthDivider />

          {error && (
            <ErrorCallout
              className="mb-4"
              title="Sign in failed"
              what={error}
              fix={
                error.toLowerCase().includes("invalid")
                  ? "Double-check your email and password."
                  : "Try again or reset your password."
              }
              onRetry={() => setError(null)}
            />
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--ink-secondary)]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-[var(--ink-tertiary)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
