import { NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth/server";
import { ensureSubscription, canUseFeature, PLAN_LIMITS } from "@/lib/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";

export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await ensureSubscription(user.id);
  const billingEnabled = isFeatureEnabled("billing");

  const [search, consultant, tailor, applications] = await Promise.all([
    canUseFeature(user.id, "job_search"),
    canUseFeature(user.id, "ai_consultant"),
    canUseFeature(user.id, "resume_tailor"),
    canUseFeature(user.id, "application"),
  ]);

  return NextResponse.json({
    plan: sub.plan,
    status: sub.status,
    billingEnabled,
    limits: PLAN_LIMITS[sub.plan],
    usage: {
      job_search: search,
      ai_consultant: consultant,
      resume_tailor: tailor,
      application: applications,
    },
  });
}
