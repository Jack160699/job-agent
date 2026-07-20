"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseNumberOrFallback,
  parseOptionalInteger,
} from "@/lib/forms/numbers";

export interface PreferenceFormValues {
  jobTitles: string;
  requiredSkills: string;
  preferredSkills: string;
  experienceYears: string;
  locations: string;
  workModes: string[];
  salaryMin: string;
  salaryMax: string;
  targetCompanies: string;
  excludedCompanies: string;
  industries: string;
  willingToRelocate: boolean;
  visaSponsorshipRequired: boolean;
  noticePeriodDays: string;
  matchThreshold: string;
}

const WORK_MODE_OPTIONS = [
  { id: "REMOTE", label: "Remote" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ONSITE", label: "On-site" },
];

export function parsePreferenceForm(values: PreferenceFormValues) {
  return {
    jobTitles: values.jobTitles.split(",").map((s) => s.trim()).filter(Boolean),
    requiredSkills: values.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
    preferredSkills: values.preferredSkills.split(",").map((s) => s.trim()).filter(Boolean),
    experienceYears: parseOptionalInteger(values.experienceYears),
    locations: values.locations.split(",").map((s) => s.trim()).filter(Boolean),
    workModes: values.workModes,
    salaryMin: values.salaryMin ? parseInt(values.salaryMin, 10) : null,
    salaryMax: values.salaryMax ? parseInt(values.salaryMax, 10) : null,
    targetCompanies: values.targetCompanies.split(",").map((s) => s.trim()).filter(Boolean),
    excludedCompanies: values.excludedCompanies.split(",").map((s) => s.trim()).filter(Boolean),
    industries: values.industries.split(",").map((s) => s.trim()).filter(Boolean),
    willingToRelocate: values.willingToRelocate,
    visaSponsorshipRequired: values.visaSponsorshipRequired,
    noticePeriodDays: values.noticePeriodDays ? parseInt(values.noticePeriodDays, 10) : null,
    matchThreshold: parseNumberOrFallback(values.matchThreshold, 70),
  };
}

export function JobPreferencesFields({
  values,
  onChange,
  compact = false,
}: {
  values: PreferenceFormValues;
  onChange: (v: PreferenceFormValues) => void;
  compact?: boolean;
}) {
  const set = (patch: Partial<PreferenceFormValues>) =>
    onChange({ ...values, ...patch });

  const toggleWorkMode = (mode: string) => {
    const next = values.workModes.includes(mode)
      ? values.workModes.filter((m) => m !== mode)
      : [...values.workModes, mode];
    set({ workModes: next });
  };

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className="space-y-2">
        <Label>Desired job titles *</Label>
        <Input
          value={values.jobTitles}
          onChange={(e) => set({ jobTitles: e.target.value })}
          placeholder="Software Engineer, Backend Developer"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label>Primary skills *</Label>
        <Input
          value={values.requiredSkills}
          onChange={(e) => set({ requiredSkills: e.target.value })}
          placeholder="TypeScript, React, Node.js"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label>Preferred skills</Label>
        <Input
          value={values.preferredSkills}
          onChange={(e) => set({ preferredSkills: e.target.value })}
          placeholder="PostgreSQL, AWS"
          className="h-11"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Years of experience *</Label>
          <Input
            type="number"
            min={0}
            value={values.experienceYears}
            onChange={(e) => set({ experienceYears: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>Minimum match score</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={values.matchThreshold}
            onChange={(e) => set({ matchThreshold: e.target.value })}
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preferred locations *</Label>
        <Input
          value={values.locations}
          onChange={(e) => set({ locations: e.target.value })}
          placeholder="Remote, San Francisco, New York"
          className="h-11"
        />
        <p className="text-xs text-[var(--ink-tertiary)]">
          Include Remote if you want remote roles. Select work modes below.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Work mode</Label>
        <div className="flex flex-wrap gap-2">
          {WORK_MODE_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={values.workModes.includes(opt.id) ? "default" : "outline"}
              onClick={() => toggleWorkMode(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Salary min (USD)</Label>
          <Input
            type="number"
            value={values.salaryMin}
            onChange={(e) => set({ salaryMin: e.target.value })}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>Salary max (USD)</Label>
          <Input
            type="number"
            value={values.salaryMax}
            onChange={(e) => set({ salaryMax: e.target.value })}
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target companies (optional)</Label>
        <Input
          value={values.targetCompanies}
          onChange={(e) => set({ targetCompanies: e.target.value })}
          placeholder="stripe, notion"
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label>Excluded companies</Label>
        <Input
          value={values.excludedCompanies}
          onChange={(e) => set({ excludedCompanies: e.target.value })}
          placeholder="companies to skip"
          className="h-11"
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.willingToRelocate}
            onChange={(e) => set({ willingToRelocate: e.target.checked })}
          />
          Willing to relocate
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.visaSponsorshipRequired}
            onChange={(e) => set({ visaSponsorshipRequired: e.target.checked })}
          />
          Visa sponsorship required
        </label>
      </div>
    </div>
  );
}

export const defaultPreferenceValues: PreferenceFormValues = {
  jobTitles: "",
  requiredSkills: "",
  preferredSkills: "",
  experienceYears: "",
  locations: "",
  workModes: ["REMOTE"],
  salaryMin: "",
  salaryMax: "",
  targetCompanies: "",
  excludedCompanies: "",
  industries: "",
  willingToRelocate: false,
  visaSponsorshipRequired: false,
  noticePeriodDays: "",
  matchThreshold: "70",
};
