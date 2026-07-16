"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Link2, Unplug } from "lucide-react";
import { trackAuthEvent } from "@/lib/analytics/events";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { canUnlinkIdentity, type IdentitySummary } from "@/lib/auth/identity-policy";
import type { UserIdentity } from "@supabase/supabase-js";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  linkedin_oidc: "LinkedIn",
  email: "Email/password",
};

export function ConnectedAccounts() {
  const searchParams = useSearchParams();
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [manualLinkingSupported, setManualLinkingSupported] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      setIdentities(data?.identities ?? []);
    } catch {
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (searchParams.get("linked") !== "linkedin_oidc") return;
    trackAuthEvent("linkedin_identity_linked");
    toast.success("LinkedIn connected");
    queueMicrotask(() => void load());
  }, [searchParams, load]);

  const hasProvider = (id: string) => identities.some((i) => i.provider === id);

  const connectLinkedIn = async () => {
    setBusyProvider("linkedin_oidc");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "linkedin_oidc",
        options: {
          redirectTo: `${window.location.origin}/dashboard/settings?linked=linkedin_oidc`,
        },
      });
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        if (message.includes("manual linking") || message.includes("disabled")) {
          setManualLinkingSupported(false);
        } else {
          toast.error(error.message || "Couldn't connect LinkedIn.");
        }
        setBusyProvider(null);
      }
      // On success Supabase navigates the browser away to LinkedIn — nothing else to do here.
    } catch {
      toast.error("Couldn't connect LinkedIn.");
      setBusyProvider(null);
    }
  };

  const unlink = async (identity: UserIdentity) => {
    const summaries: IdentitySummary[] = identities.map((i) => ({ provider: i.provider }));
    const decision = canUnlinkIdentity(summaries, { provider: identity.provider });
    if (!decision.allowed) {
      toast.error(decision.reason ?? "Can't disconnect this account.");
      return;
    }

    const label = PROVIDER_LABELS[identity.provider] ?? identity.provider;
    if (!window.confirm(`Disconnect ${label}? You can reconnect later.`)) return;

    setBusyProvider(identity.provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) {
        toast.error(error.message || `Couldn't disconnect ${label}. Try again later.`);
        return;
      }
      if (identity.provider === "linkedin_oidc") {
        trackAuthEvent("linkedin_identity_unlinked");
      }
      toast.success(`${label} disconnected`);
      await load();
    } catch {
      toast.error(`Couldn't disconnect ${label}. Try again later.`);
    } finally {
      setBusyProvider(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--ink-tertiary)]">Loading connected accounts…</p>;
  }

  const rows: Array<{ id: string; label: string; connected: boolean; identity?: UserIdentity }> = [
    {
      id: "google",
      label: "Google",
      connected: hasProvider("google"),
      identity: identities.find((i) => i.provider === "google"),
    },
    ...(FEATURE_FLAGS.linkedinAuth
      ? [
          {
            id: "linkedin_oidc",
            label: "LinkedIn",
            connected: hasProvider("linkedin_oidc"),
            identity: identities.find((i) => i.provider === "linkedin_oidc"),
          },
        ]
      : []),
    {
      id: "email",
      label: "Email/password",
      connected: hasProvider("email"),
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-3 rounded-lg border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">{row.label}</p>
            <p className="text-xs text-[var(--ink-tertiary)]">
              {row.connected ? "Connected" : "Not connected"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.connected ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
                {row.id !== "email" && row.identity && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    onClick={() => unlink(row.identity!)}
                    disabled={busyProvider != null || identities.length <= 1}
                    title={
                      identities.length <= 1
                        ? "You need at least one other way to sign in before disconnecting this account."
                        : undefined
                    }
                  >
                    <Unplug className="h-3 w-3" />
                    Disconnect
                  </Button>
                )}
              </>
            ) : row.id === "linkedin_oidc" ? (
              manualLinkingSupported ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={connectLinkedIn}
                  disabled={busyProvider != null}
                >
                  <Link2 className="h-3 w-3" />
                  Connect LinkedIn
                </Button>
              ) : (
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Account linking isn&apos;t enabled for this project yet.
                </p>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
