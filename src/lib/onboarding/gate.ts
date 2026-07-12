import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDbUser } from "@/lib/auth/server";
import { isOnboardingComplete } from "@/lib/onboarding/service";

/** Redirect incomplete onboarding users to the conversational flow. */
export async function ensureOnboardingComplete(allowOnboardingPage = false) {
  const user = await getDbUser();
  if (!user) return;
  const complete = await isOnboardingComplete(user.id);
  if (!complete && !allowOnboardingPage) {
    redirect("/dashboard/onboarding");
  }
  if (complete && allowOnboardingPage) {
    redirect("/dashboard/jobs");
  }
}

export async function ensureOnboardingFromPath() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onOnboarding = pathname.startsWith("/dashboard/onboarding");
  await ensureOnboardingComplete(onOnboarding);
}
