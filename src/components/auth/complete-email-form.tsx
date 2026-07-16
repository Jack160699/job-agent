"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ErrorCallout } from "@/components/ui/error-callout";
import { createClient } from "@/lib/supabase/client";
import { trackAuthEvent } from "@/lib/analytics/events";
import { toast } from "sonner";

/** Never reveals whether the entered email already belongs to another account. */
const GENERIC_EMAIL_ERROR =
  "We couldn't use that email. Try a different one, or sign in with your existing account instead.";

export function CompleteEmailForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    trackAuthEvent("linkedin_email_completion_required");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser(
        { email },
        {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        }
      );

      if (updateError) {
        setError(GENERIC_EMAIL_ERROR);
        return;
      }

      setSent(true);
      toast.success("Check your email to confirm and finish setting up your account");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Confirm your email" description="One more step to finish setting up Kairela">
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-[var(--ink-secondary)]">
            <p>
              We sent a confirmation link to <strong className="text-[var(--ink)]">{email}</strong>.
              Click it to finish creating your Kairela account.
            </p>
            <p className="text-xs text-[var(--ink-tertiary)]">
              Didn&apos;t get it? Check spam, or refresh this page to try a different email.
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Add your email" description="LinkedIn didn't share an email address">
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-[var(--ink-secondary)]">
            LinkedIn did not share an email address. Add an email to finish creating your Kairela
            account.
          </p>

          {error && (
            <ErrorCallout
              title="Couldn't add that email"
              what={error}
              onRetry={() => setError(null)}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="complete-email">Email</Label>
              <Input
                id="complete-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Sending…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
