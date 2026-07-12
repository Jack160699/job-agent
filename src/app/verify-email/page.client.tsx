"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error("Enter your email address");
      return;
    }
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Verification email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      description="We sent a confirmation link to activate your account"
    >
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-[var(--accent-muted)] p-4">
              <Mail className="h-8 w-8 text-[var(--accent)]" />
            </div>
          </div>

          <div className="space-y-2 text-center text-sm text-[var(--ink-secondary)]">
            <p>
              Click the link in your email to verify your account. You won&apos;t be able to
              sign in until verification is complete.
            </p>
            {emailParam && (
              <p className="font-medium text-[var(--ink-secondary)]">{emailParam}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="resend-email">Didn&apos;t receive it?</Label>
            <Input
              id="resend-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
            <Button
              onClick={handleResend}
              disabled={resending}
              variant="outline"
              className="h-11 w-full gap-2"
            >
              {resending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : sent ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {resending ? "Sending…" : sent ? "Email sent — check inbox" : "Resend verification email"}
            </Button>
          </div>

          <p className="text-center text-sm text-[var(--ink-tertiary)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
