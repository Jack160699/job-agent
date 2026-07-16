"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import type { OnboardingDraft } from "@/lib/onboarding/steps";
import { trackOnboardingEvent } from "@/lib/analytics/events";
import { ChipListEditor } from "./chip-list-editor";

interface PreferencesScreenProps {
  draft: OnboardingDraft;
  onCompleted: (draft: OnboardingDraft) => void;
}

const WORK_MODES = [
  { id: "REMOTE", label: "Remote" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ONSITE", label: "On-site" },
];

const EMPLOYMENT_TYPES = [
  { id: "FULL_TIME", label: "Full-time" },
  { id: "PART_TIME", label: "Part-time" },
  { id: "CONTRACT", label: "Contract" },
  { id: "INTERNSHIP", label: "Internship" },
  { id: "FREELANCE", label: "Freelance" },
];

function guessCurrency(location?: string): string {
  const l = (location ?? "").toLowerCase();
  if (/india/.test(l)) return "INR";
  if (/united kingdom|\buk\b/.test(l)) return "GBP";
  if (/germany|france|spain|italy|netherlands|ireland|portugal|europe/.test(l)) return "EUR";
  if (/canada/.test(l)) return "CAD";
  if (/australia/.test(l)) return "AUD";
  return "USD";
}

function splitCsv(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
function joinCsv(values?: string[]): string {
  return values?.join(", ") ?? "";
}

export function PreferencesScreen({ draft, onCompleted }: PreferencesScreenProps) {
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const [fullName, setFullName] = useState(draft.fullName ?? "");
  const [currentLocation, setCurrentLocation] = useState(draft.currentLocation ?? "");
  const [currentRole, setCurrentRole] = useState(draft.currentRole ?? "");
  const [experienceYears, setExperienceYears] = useState<string>(
    draft.experienceYears != null ? String(draft.experienceYears) : ""
  );
  const [requiredSkills, setRequiredSkills] = useState<string[]>(draft.requiredSkills ?? []);
  const [jobTitles, setJobTitles] = useState<string[]>(draft.jobTitles ?? []);

  const [locations, setLocations] = useState<string[]>(draft.locations ?? []);
  const [workModes, setWorkModes] = useState<string[]>(draft.workModes ?? []);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>(draft.employmentTypes ?? ["FULL_TIME"]);
  const [salaryMin, setSalaryMin] = useState<string>(draft.salaryMin != null ? String(draft.salaryMin) : "");
  const [salaryMax, setSalaryMax] = useState<string>(draft.salaryMax != null ? String(draft.salaryMax) : "");
  const [salaryCurrency, setSalaryCurrency] = useState(
    draft.salaryCurrency ?? guessCurrency(draft.currentLocation)
  );
  const [noticePeriodDays, setNoticePeriodDays] = useState<string>(
    draft.noticePeriodDays != null ? String(draft.noticePeriodDays) : ""
  );
  const [willingToRelocate, setWillingToRelocate] = useState(draft.willingToRelocate ?? false);
  const [requireReview, setRequireReview] = useState(draft.requireReview ?? true);
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(draft.autoSubmitEnabled ?? false);

  const [targetCompanies, setTargetCompanies] = useState(joinCsv(draft.targetCompanies));
  const [excludedCompanies, setExcludedCompanies] = useState(joinCsv(draft.excludedCompanies));
  const [industries, setIndustries] = useState(joinCsv(draft.industries));
  const [searchFrequencyHours, setSearchFrequencyHours] = useState(
    String(draft.searchFrequencyHours ?? 6)
  );

  const needsFullName = !draft.fullName;
  const needsLocation = !draft.currentLocation;
  const needsRole = !draft.currentRole;
  const needsExperience = draft.experienceYears == null;
  const needsSkills = !draft.requiredSkills?.length;
  const needsJobTitles = !draft.jobTitles?.length;

  const canSubmit =
    (jobTitles.length > 0) &&
    locations.length > 0 &&
    workModes.length > 0 &&
    !saving;

  const handleSubmit = async () => {
    if (jobTitles.length === 0) {
      toast.error("Add at least one target job title.");
      return;
    }
    if (locations.length === 0 && !workModes.includes("REMOTE")) {
      toast.error("Add a preferred location or choose remote.");
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<OnboardingDraft> = {
        fullName: fullName.trim() || undefined,
        currentLocation: currentLocation.trim() || undefined,
        currentRole: currentRole.trim() || undefined,
        experienceYears: experienceYears.trim() ? Number(experienceYears) : null,
        requiredSkills,
        jobTitles,
        locations,
        workModes,
        employmentTypes,
        salaryMin: salaryMin.trim() ? Number(salaryMin) : null,
        salaryMax: salaryMax.trim() ? Number(salaryMax) : null,
        salaryCurrency,
        noticePeriodDays: noticePeriodDays.trim() ? Number(noticePeriodDays) : null,
        willingToRelocate,
        requireReview,
        autoSubmitEnabled,
        targetCompanies: splitCsv(targetCompanies),
        excludedCompanies: splitCsv(excludedCompanies),
        industries: splitCsv(industries),
        searchFrequencyHours: searchFrequencyHours.trim() ? Number(searchFrequencyHours) : 6,
      };

      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: patch, currentStep: "preferences", nav: "next" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save preferences");

      trackOnboardingEvent("onboarding_preferences_completed");
      onCompleted(data.draft ?? { ...draft, ...patch });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--rf-ink)]">Tell us what your resume can&apos;t</h1>
        <p className="mt-1.5 text-sm text-[var(--rf-ink-secondary)]">
          A few quick preferences and we&apos;ll start matching you to roles.
        </p>
      </div>

      {(needsFullName || needsLocation || needsRole || needsExperience || needsSkills) && (
        <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--rf-ink)]">A little about you</h2>
          {needsFullName && (
            <div className="space-y-1.5">
              <Label htmlFor="pref-full-name" className="text-xs text-[var(--rf-ink-secondary)]">
                Full name
              </Label>
              <Input
                id="pref-full-name"
                className="h-11"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          {needsLocation && (
            <div className="space-y-1.5">
              <Label htmlFor="pref-current-location" className="text-xs text-[var(--rf-ink-secondary)]">
                Current location
              </Label>
              <Input
                id="pref-current-location"
                className="h-11"
                placeholder="Pune, India"
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
              />
            </div>
          )}
          {needsRole && (
            <div className="space-y-1.5">
              <Label htmlFor="pref-current-role" className="text-xs text-[var(--rf-ink-secondary)]">
                Current role
              </Label>
              <Input
                id="pref-current-role"
                className="h-11"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
              />
            </div>
          )}
          {needsExperience && (
            <div className="space-y-1.5">
              <Label htmlFor="pref-experience-years" className="text-xs text-[var(--rf-ink-secondary)]">
                Years of experience
              </Label>
              <Input
                id="pref-experience-years"
                type="number"
                min={0}
                className="h-11 w-32"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
          )}
          {needsSkills && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--rf-ink-secondary)]">Skills</Label>
              <ChipListEditor label="Skills" values={requiredSkills} onChange={setRequiredSkills} />
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Job search preferences</h2>

        {needsJobTitles && (
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--rf-ink-secondary)]">Target job titles *</Label>
            <ChipListEditor label="Target job titles" values={jobTitles} onChange={setJobTitles} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--rf-ink-secondary)]">Preferred locations</Label>
          <ChipListEditor
            label="Preferred locations"
            values={locations}
            onChange={setLocations}
            placeholder="Add a city and press Enter"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--rf-ink-secondary)]">Work mode *</Label>
          <div className="flex flex-wrap gap-2">
            {WORK_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={workModes.includes(m.id)}
                className={[
                  "h-11 rounded-full border px-4 text-sm font-medium",
                  workModes.includes(m.id)
                    ? "border-[var(--rf-primary)] bg-[var(--rf-primary-muted)] text-[var(--rf-primary)]"
                    : "border-[var(--rf-line-strong)] text-[var(--rf-ink-secondary)]",
                ].join(" ")}
                onClick={() =>
                  setWorkModes((prev) =>
                    prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                  )
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--rf-ink-secondary)]">Employment type</Label>
          <div className="flex flex-wrap gap-2">
            {EMPLOYMENT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={employmentTypes.includes(t.id)}
                className={[
                  "h-11 rounded-full border px-4 text-sm font-medium",
                  employmentTypes.includes(t.id)
                    ? "border-[var(--rf-primary)] bg-[var(--rf-primary-muted)] text-[var(--rf-primary)]"
                    : "border-[var(--rf-line-strong)] text-[var(--rf-ink-secondary)]",
                ].join(" ")}
                onClick={() =>
                  setEmploymentTypes((prev) =>
                    prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                  )
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pref-salary-min" className="text-xs text-[var(--rf-ink-secondary)]">
              Salary min
            </Label>
            <Input
              id="pref-salary-min"
              type="number"
              className="h-11"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-salary-max" className="text-xs text-[var(--rf-ink-secondary)]">
              Salary max
            </Label>
            <Input
              id="pref-salary-max"
              type="number"
              className="h-11"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pref-salary-currency" className="text-xs text-[var(--rf-ink-secondary)]">
              Currency
            </Label>
            <Input
              id="pref-salary-currency"
              className="h-11"
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pref-notice-period" className="text-xs text-[var(--rf-ink-secondary)]">
            Notice period (days)
          </Label>
          <Input
            id="pref-notice-period"
            type="number"
            className="h-11 w-32"
            value={noticePeriodDays}
            onChange={(e) => setNoticePeriodDays(e.target.value)}
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--rf-ink)]">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={willingToRelocate}
            onChange={(e) => setWillingToRelocate(e.target.checked)}
          />
          Willing to relocate
        </label>
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">How Kairela should apply on your behalf</h2>
        <label className="flex min-h-11 items-start gap-2 text-sm text-[var(--rf-ink)]">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5"
            checked={requireReview}
            onChange={(e) => setRequireReview(e.target.checked)}
          />
          <span>Review every application before it&apos;s submitted (recommended)</span>
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm text-[var(--rf-ink)]">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5"
            checked={autoSubmitEnabled}
            onChange={(e) => setAutoSubmitEnabled(e.target.checked)}
          />
          <span>
            Allow Kairela to auto-submit high-match applications without my review. You can change this
            anytime in Settings.
          </span>
        </label>
      </section>

      <button
        type="button"
        className="text-sm font-medium text-[var(--rf-primary)]"
        onClick={() => setShowOptional((v) => !v)}
      >
        {showOptional ? "Hide optional preferences" : "Add optional preferences"}
      </button>

      {showOptional && (
        <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--rf-ink-secondary)]">Target companies</Label>
            <Input className="h-11" value={targetCompanies} onChange={(e) => setTargetCompanies(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--rf-ink-secondary)]">Excluded companies</Label>
            <Input className="h-11" value={excludedCompanies} onChange={(e) => setExcludedCompanies(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--rf-ink-secondary)]">Preferred industries</Label>
            <Input className="h-11" value={industries} onChange={(e) => setIndustries(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--rf-ink-secondary)]">Job alert frequency (hours)</Label>
            <Input
              type="number"
              min={1}
              className="h-11 w-32"
              value={searchFrequencyHours}
              onChange={(e) => setSearchFrequencyHours(e.target.value)}
            />
          </div>
        </section>
      )}

      <Button
        type="button"
        className="h-11 w-full gap-1.5 bg-[var(--rf-primary)] hover:bg-[var(--rf-primary-hover)]"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {saving ? "Saving…" : "Continue"} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
