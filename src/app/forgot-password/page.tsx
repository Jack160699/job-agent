"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
      toast.success("Password reset email sent");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      description={
        sent
          ? "Check your email for a reset link"
          : "Enter your email to receive a reset link"
      }
    >
      <Card>
        <CardContent className="p-6">
          {sent ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/10 p-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </div>
              <p className="text-sm text-[var(--ink-secondary)]">
                We sent a password reset link to <strong className="text-[var(--ink-secondary)]">{email}</strong>
              </p>
              <Link href="/login">
                <Button className="h-11 w-full">Back to Sign In</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="flex justify-center pb-2">
                <div className="rounded-full bg-[var(--accent-muted)] p-4">
                  <Mail className="h-8 w-8 text-[var(--accent)]" />
                </div>
              </div>
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
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[var(--ink-secondary)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
