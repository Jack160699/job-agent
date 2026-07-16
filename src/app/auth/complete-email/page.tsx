import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSafeInternalRedirect } from "@/lib/security/oauth-state";
import { CompleteEmailForm } from "@/components/auth/complete-email-form";

export default async function CompleteEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = nextParam && isSafeInternalRedirect(nextParam) ? nextParam : "/dashboard";

  // Server-side session gate: this page only ever operates on the current
  // authenticated Supabase session — there is no user-id input, so it
  // cannot be used to change another account's email.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return <CompleteEmailForm next={next} />;
}
