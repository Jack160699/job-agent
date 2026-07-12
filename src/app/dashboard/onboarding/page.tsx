"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  JobPreferencesFields,
  defaultPreferenceValues,
  parsePreferenceForm,
  type PreferenceFormValues,
} from "@/components/dashboard/job-preferences-fields";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<PreferenceFormValues>(defaultPreferenceValues);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings;
        if (!s) return;
        setValues({
          jobTitles: s.jobTitles?.join(", ") || "",
          requiredSkills: s.requiredSkills?.join(", ") || "",
          preferredSkills: s.preferredSkills?.join(", ") || "",
          experienceYears: s.experienceYears?.toString() || "",
          locations: s.locations?.join(", ") || "",
          workModes: s.workModes?.length ? s.workModes : ["REMOTE"],
          salaryMin: s.salaryMin?.toString() || "",
          salaryMax: s.salaryMax?.toString() || "",
          targetCompanies: s.targetCompanies?.join(", ") || "",
          excludedCompanies: s.excludedCompanies?.join(", ") || "",
          industries: s.industries?.join(", ") || "",
          willingToRelocate: s.willingToRelocate ?? false,
          visaSponsorshipRequired: s.visaSponsorshipRequired ?? false,
          noticePeriodDays: s.noticePeriodDays?.toString() || "",
          matchThreshold: s.matchThreshold?.toString() || "70",
        });
        if (s.preferencesComplete) router.replace("/dashboard/jobs");
      })
      .catch(() => {});
  }, [router]);

  const save = async () => {
    const parsed = parsePreferenceForm(values);
    if (!parsed.jobTitles.length || !parsed.requiredSkills.length) {
      toast.error("Job titles and primary skills are required");
      return;
    }
    if (!parsed.locations.length && !parsed.workModes.includes("REMOTE")) {
      toast.error("Add locations or select Remote work mode");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, preferencesComplete: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Preferences saved — you're ready to search!");
      router.push("/dashboard/jobs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">Set up job search</h1>
        <p className="mt-1 text-sm text-[var(--ink-tertiary)]">
          Tell us what you&apos;re looking for. This takes about 2 minutes and is required before your first search.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <JobPreferencesFields values={values} onChange={setValues} />
        </CardContent>
      </Card>

      <Button className="h-11 w-full" disabled={loading} onClick={save}>
        {loading ? "Saving…" : "Save & continue to job search"}
      </Button>
    </div>
  );
}
