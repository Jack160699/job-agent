import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import prisma from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export default async function HiringFoundationPage() {
  const user = await getDbUser();
  if (!user) redirect("/login");

  const persona = user.persona;
  const allowed =
    (persona === "EMPLOYER" && isFeatureEnabled("employerMode")) ||
    (persona === "RECRUITER" && isFeatureEnabled("recruiterMode")) ||
    (persona === "AGENCY" && isFeatureEnabled("agencyMode"));

  if (!allowed) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Hiring workspace</h1>
        <Card>
          <CardContent className="p-6 text-sm text-[var(--ink-secondary)]">
            Employer, recruiter, and agency modes are in private preview. Candidate
            profiles remain private by default. Contact support to request early access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = await prisma.hiringProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hiring workspace</h1>
        <p className="text-sm text-[var(--ink-secondary)]">
          Foundation preview — candidate discovery requires explicit consent.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <p>
            <span className="text-[var(--ink-tertiary)]">Persona:</span> {persona}
          </p>
          {profile?.companyName && (
            <p>
              <span className="text-[var(--ink-tertiary)]">Company:</span>{" "}
              {profile.companyName}
            </p>
          )}
          {profile?.hiringGoal && (
            <p>
              <span className="text-[var(--ink-tertiary)]">Goal:</span> {profile.hiringGoal}
            </p>
          )}
          <p className="text-[var(--ink-tertiary)]">
            Full hiring workflows are feature-flagged until privacy and compliance review
            is complete. No candidate data is scraped or exposed without consent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
