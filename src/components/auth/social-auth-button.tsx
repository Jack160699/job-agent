"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trackAuthEvent } from "@/lib/analytics/events";
import { GoogleIcon, LinkedInIcon } from "./social-icons";
import { SOCIAL_PROVIDERS, type SocialProviderId } from "@/lib/auth/social-providers";

const PROVIDER_ICONS: Record<SocialProviderId, typeof GoogleIcon> = {
  google: GoogleIcon,
  linkedin_oidc: LinkedInIcon,
};

const PROVIDER_DISPLAY_NAME: Record<SocialProviderId, string> = {
  google: "Google",
  linkedin_oidc: "LinkedIn",
};

export function SocialAuthButton({
  provider,
  className,
}: {
  provider: SocialProviderId;
  /** Unused beyond label parity with the rest of the auth form; both modes use the same OAuth call. */
  mode?: "signin" | "signup";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const config = SOCIAL_PROVIDERS[provider];
  const Icon = PROVIDER_ICONS[provider];

  if (!config.enabled) return null;

  const handleAuth = async () => {
    setLoading(true);
    if (provider === "linkedin_oidc") trackAuthEvent("linkedin_auth_started");

    try {
      const supabase = createClient();
      // redirectTo is always built from the current origin plus a fixed,
      // hardcoded internal path — never from user input — so this cannot
      // become an open redirect regardless of provider.
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard&provider=${provider}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options:
          provider === "google"
            ? {
                redirectTo,
                queryParams: { access_type: "online", prompt: "select_account" },
              }
            : { redirectTo },
      });

      if (error) {
        toast.error(error.message);
        if (provider === "linkedin_oidc") {
          trackAuthEvent("linkedin_auth_failed", { errorCategory: "initiation" });
        }
        setLoading(false);
      }
    } catch {
      toast.error(`Failed to connect with ${PROVIDER_DISPLAY_NAME[provider]}`);
      if (provider === "linkedin_oidc") {
        trackAuthEvent("linkedin_auth_failed", { errorCategory: "exception" });
      }
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleAuth}
      disabled={loading}
      aria-label={loading ? `Connecting to ${PROVIDER_DISPLAY_NAME[provider]}` : config.label}
    >
      <Icon className="h-4 w-4" />
      {loading ? config.connectingLabel : config.label}
    </Button>
  );
}
