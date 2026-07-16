"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCcw, Upload } from "lucide-react";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import type { FieldMergeOutcome } from "@/lib/onboarding/merge-policy";
import { trackOnboardingEvent } from "@/lib/analytics/events";
import { ChipListEditor } from "./chip-list-editor";

interface ReviewScreenProps {
  profile: ParsedCareerProfile;
  onReupload: () => void;
  onCompleted: () => void;
}

type ScalarKey =
  | "fullName"
  | "currentLocation"
  | "currentRole"
  | "linkedinUrl"
  | "githubUrl"
  | "portfolioUrl";

const SCALAR_LABELS: Record<ScalarKey, string> = {
  fullName: "Full name",
  currentLocation: "Current location",
  currentRole: "Current role",
  linkedinUrl: "LinkedIn URL",
  githubUrl: "GitHub URL",
  portfolioUrl: "Portfolio URL",
};

export function ReviewScreen({ profile, onReupload, onCompleted }: ReviewScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<FieldMergeOutcome[]>([]);
  const [conflicts, setConflicts] = useState<FieldMergeOutcome[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "existing" | "incoming">>({});
  const [scalarEdits, setScalarEdits] = useState<Partial<Record<ScalarKey, string>>>({});
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "review_preview", profile }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load review");
        if (cancelled) return;
        setOutcomes(data.outcomes ?? []);
        setConflicts(data.conflicts ?? []);
        const byKey = (key: string) => (data.outcomes as FieldMergeOutcome[]).find((o) => o.key === key);
        setJobTitles((byKey("jobTitles")?.value as string[] | undefined) ?? profile.jobTitles.value);
        setSkills((byKey("requiredSkills")?.value as string[] | undefined) ?? profile.skills.value);
        setExperienceYears(
          String((byKey("experienceYears")?.value as number | null | undefined) ?? profile.experienceYears.value ?? "")
        );
      } catch {
        toast.error("Could not load your review — using the extracted resume data instead.");
        setJobTitles(profile.jobTitles.value);
        setSkills(profile.skills.value);
        setExperienceYears(String(profile.experienceYears.value ?? ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valueFor = (key: ScalarKey): string => {
    if (scalarEdits[key] !== undefined) return scalarEdits[key] as string;
    const outcome = outcomes.find((o) => o.key === key);
    if (outcome && outcome.status !== "conflict") return (outcome.value as string) ?? "";
    return (profile[key].value as string) ?? "";
  };

  const unresolvedConflicts = useMemo(
    () => conflicts.filter((c) => !(c.key in resolutions)),
    [conflicts, resolutions]
  );

  const handleSubmit = async () => {
    if (unresolvedConflicts.length > 0) {
      toast.error("Resolve the highlighted conflicts before continuing.");
      return;
    }
    setSaving(true);
    try {
      const edits: Record<string, unknown> = { ...scalarEdits };
      edits.jobTitles = jobTitles;
      edits.requiredSkills = skills;
      edits.experienceYears = experienceYears.trim() ? Number(experienceYears) : null;

      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_review", profile, resolutions, edits }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setConflicts(data.conflicts ?? []);
          toast.error("A few details still need your decision.");
          return;
        }
        throw new Error(data.error || "Could not save your review");
      }
      trackOnboardingEvent("onboarding_resume_review_completed", {
        fieldsFilled: outcomes.filter((o) => o.status === "filled").length,
        fieldsNeedingReview: [
          profile.fullName,
          profile.currentLocation,
          profile.currentRole,
          profile.experienceYears,
        ].filter((f) => f.needsReview).length,
      });
      onCompleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your review");
    } finally {
      setSaving(false);
    }
  };

  const acceptAllHighConfidence = () => {
    setScalarEdits({});
    setJobTitles(profile.jobTitles.value);
    setSkills(profile.skills.value);
    setExperienceYears(String(profile.experienceYears.value ?? ""));
    toast.success("Applied Kairela's extracted values");
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--rf-ink-tertiary)]">Loading your review…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--rf-ink)]">We found these details</h1>
        <p className="mt-1.5 text-sm text-[var(--rf-ink-secondary)]">
          Review and edit anything before it becomes part of your profile.
        </p>
      </div>

      {conflicts.length > 0 && (
        <section
          aria-label="Conflicts to resolve"
          className="space-y-3 rounded-[var(--rf-radius)] border border-[color:#f0c869] bg-[#fff8e6] p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--rf-warning)]">
            <AlertTriangle className="h-4 w-4" /> Your resume disagrees with your saved profile
          </p>
          {conflicts.map((conflict) => (
            <div key={conflict.key} className="space-y-1.5 text-sm">
              <p className="font-medium text-[var(--rf-ink)]">{conflict.label}</p>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3">
                  <input
                    type="radio"
                    name={`conflict-${conflict.key}`}
                    checked={(resolutions[conflict.key] ?? "existing") === "existing"}
                    onChange={() => setResolutions((r) => ({ ...r, [conflict.key]: "existing" }))}
                  />
                  Keep: {String(conflict.existingValue)}
                </label>
                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3">
                  <input
                    type="radio"
                    name={`conflict-${conflict.key}`}
                    checked={resolutions[conflict.key] === "incoming"}
                    onChange={() => setResolutions((r) => ({ ...r, [conflict.key]: "incoming" }))}
                  />
                  Use resume: {String(conflict.incomingValue)}
                </label>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Personal details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["fullName", "currentLocation"] as ScalarKey[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`review-${key}`} className="text-xs text-[var(--rf-ink-secondary)]">
                {SCALAR_LABELS[key]}
              </Label>
              <Input
                id={`review-${key}`}
                className="h-11"
                value={valueFor(key)}
                onChange={(e) => setScalarEdits((s) => ({ ...s, [key]: e.target.value }))}
              />
              {profile[key].needsReview && (
                <p className="text-xs text-[var(--rf-warning)]">Please confirm — low confidence.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Current career</h2>
        <div className="space-y-1.5">
          <Label htmlFor="review-current-role" className="text-xs text-[var(--rf-ink-secondary)]">
            {SCALAR_LABELS.currentRole}
          </Label>
          <Input
            id="review-current-role"
            className="h-11"
            value={valueFor("currentRole")}
            onChange={(e) => setScalarEdits((s) => ({ ...s, currentRole: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-experience-years" className="text-xs text-[var(--rf-ink-secondary)]">
            Years of experience
          </Label>
          <Input
            id="review-experience-years"
            type="number"
            min={0}
            className="h-11 w-32"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
          />
          {profile.experienceYears.value != null && profile.experienceYears.needsReview && (
            <p className="text-xs text-[var(--rf-warning)]">
              Estimated from your dates — please confirm.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--rf-ink-secondary)]">Target job titles</Label>
          <ChipListEditor label="Target job titles" values={jobTitles} onChange={setJobTitles} />
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Skills</h2>
        <ChipListEditor label="Skills" values={skills} onChange={setSkills} />
      </section>

      <ReadOnlyEntrySection
        title="Work experience"
        empty="No work experience detected — you can add this later in Resume History."
        items={profile.experience.value.map((e) => ({
          heading: [e.title, e.company].filter(Boolean).join(" · ") || "Untitled role",
          detail: [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – "),
        }))}
      />

      <ReadOnlyEntrySection
        title="Education"
        empty="No education detected — you can add this later in Resume History."
        items={profile.education.value.map((e) => ({
          heading: [e.degree, e.institution].filter(Boolean).join(" · ") || "Untitled",
          detail: e.endDate ?? "",
        }))}
      />

      <ReadOnlyEntrySection
        title="Projects"
        empty="No projects detected."
        items={profile.projects.value.map((p) => ({ heading: p.name ?? "Untitled project", detail: p.description ?? "" }))}
        optional
      />

      <ReadOnlyEntrySection
        title="Certifications"
        empty="No certifications detected."
        items={profile.certifications.value.map((c) => ({ heading: c, detail: "" }))}
        optional
      />

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Profile links</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["linkedinUrl", "githubUrl", "portfolioUrl"] as ScalarKey[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`review-${key}`} className="text-xs text-[var(--rf-ink-secondary)]">
                {SCALAR_LABELS[key]}
              </Label>
              <Input
                id={`review-${key}`}
                className="h-11"
                value={valueFor(key)}
                onChange={(e) => setScalarEdits((s) => ({ ...s, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="ghost" className="h-11 gap-1.5" onClick={onReupload} disabled={saving}>
          <Upload className="h-4 w-4" /> Upload a different resume
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-1.5 border-[var(--rf-line-strong)]"
          onClick={acceptAllHighConfidence}
          disabled={saving}
        >
          <RefreshCcw className="h-4 w-4" /> Reset to extracted values
        </Button>
      </div>

      <Button
        type="button"
        className="h-11 w-full gap-1.5 bg-[var(--rf-primary)] hover:bg-[var(--rf-primary-hover)]"
        onClick={handleSubmit}
        disabled={saving}
      >
        <CheckCircle2 className="h-4 w-4" />
        {saving ? "Saving…" : "Looks good, continue"}
      </Button>
    </div>
  );
}

function ReadOnlyEntrySection({
  title,
  items,
  empty,
  optional,
}: {
  title: string;
  items: Array<{ heading: string; detail: string }>;
  empty: string;
  optional?: boolean;
}) {
  if (items.length === 0 && optional) return null;
  return (
    <section className="space-y-2 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
      <h2 className="text-sm font-semibold text-[var(--rf-ink)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--rf-ink-tertiary)]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="rounded-[var(--rf-radius-sm)] bg-[var(--rf-surface)] p-2.5 text-sm">
              <p className="font-medium text-[var(--rf-ink)]">{item.heading}</p>
              {item.detail && <p className="text-xs text-[var(--rf-ink-secondary)]">{item.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
