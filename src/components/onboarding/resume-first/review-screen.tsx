"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCcw, Upload } from "lucide-react";
import type {
  EducationEntry,
  ExperienceEntry,
  ParsedCareerProfile,
  ProjectEntry,
} from "@/lib/resumes/career-profile";
import type { AtsReadinessScore } from "@/lib/resumes/ats-score";
import type { FieldMergeOutcome } from "@/lib/onboarding/merge-policy";
import { trackOnboardingEvent } from "@/lib/analytics/events";
import { ChipListEditor } from "./chip-list-editor";
import { EntryListEditor } from "./entry-list-editor";
import { AtsScoreCard } from "./ats-score-card";
import { searchJobTitles } from "@/lib/data/job-titles";
import {
  searchLocations,
  formatLocationLabel,
} from "@/lib/data/locations";
import { searchAutocompleteCatalog } from "@/lib/data/autocomplete-catalogs";

const EMPTY_EXPERIENCE: ExperienceEntry = {
  title: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
  evidence: "user-entered",
};
const EMPTY_EDUCATION: EducationEntry = {
  degree: "",
  institution: "",
  field: "",
  startDate: "",
  endDate: "",
  evidence: "user-entered",
};
const EMPTY_PROJECT: ProjectEntry = {
  name: "",
  description: "",
  technologies: [],
  evidence: "user-entered",
};

interface ReviewScreenProps {
  profile: ParsedCareerProfile;
  atsScore?: AtsReadinessScore | null;
  enrichmentPending?: boolean;
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

export function ReviewScreen({
  profile,
  atsScore,
  enrichmentPending,
  onReupload,
  onCompleted,
}: ReviewScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<FieldMergeOutcome[]>([]);
  const [conflicts, setConflicts] = useState<FieldMergeOutcome[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "existing" | "incoming">>({});
  const [scalarEdits, setScalarEdits] = useState<Partial<Record<ScalarKey, string>>>({});
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<string>("");

  const [professionalSummary, setProfessionalSummary] = useState(
    profile.professionalSummary.value ?? ""
  );
  const [experience, setExperience] = useState<ExperienceEntry[]>(profile.experience.value);
  const [education, setEducation] = useState<EducationEntry[]>(profile.education.value);
  const [projects, setProjects] = useState<ProjectEntry[]>(profile.projects.value);
  const [certifications, setCertifications] = useState<string[]>(profile.certifications.value);
  const [languages, setLanguages] = useState<string[]>(profile.languages.value);
  const [sectionsDirty, setSectionsDirty] = useState(false);

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
      if (sectionsDirty) {
        const sectionRes = await fetch("/api/resumes/master/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professionalSummary: professionalSummary.trim() || null,
            experience,
            education,
            projects,
            certifications,
            languages,
          }),
        });
        const sectionData = await sectionRes.json();
        if (!sectionRes.ok) throw new Error(sectionData.error || "Could not save resume sections");
      }

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
    setProfessionalSummary(profile.professionalSummary.value ?? "");
    setExperience(profile.experience.value);
    setEducation(profile.education.value);
    setProjects(profile.projects.value);
    setCertifications(profile.certifications.value);
    setLanguages(profile.languages.value);
    setSectionsDirty(false);
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

      {atsScore && <AtsScoreCard score={atsScore} enrichmentPending={enrichmentPending} />}

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
          <ChipListEditor
            label="Target job titles"
            values={jobTitles}
            onChange={setJobTitles}
            suggestions={searchJobTitles}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Skills</h2>
        <ChipListEditor
          label="Skills"
          values={skills}
          onChange={setSkills}
          suggestions={(query) => searchAutocompleteCatalog("skills", query)}
        />
      </section>

      <section className="space-y-2 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Headline / summary</h2>
        <textarea
          className="min-h-24 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 py-2 text-sm text-[var(--rf-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-primary)]"
          value={professionalSummary}
          placeholder="A short summary of your experience"
          onChange={(e) => {
            setProfessionalSummary(e.target.value);
            setSectionsDirty(true);
          }}
        />
      </section>

      <EntryListEditor
        title="Work experience"
        entries={experience}
        onChange={(next) => {
          setExperience(next);
          setSectionsDirty(true);
        }}
        emptyEntry={EMPTY_EXPERIENCE}
        emptyMessage="No work experience detected — add your roles below."
        addLabel="Add role"
        entrySummary={(e) => [e.title, e.company].filter(Boolean).join(" · ")}
        fields={[
          { key: "title", label: "Title", placeholder: "Software Engineer", suggestions: searchJobTitles },
          { key: "company", label: "Company", placeholder: "Acme Inc", suggestions: (query) => searchAutocompleteCatalog("companies", query) },
          { key: "location", label: "Location", placeholder: "Pune, India", suggestions: (query) => searchLocations(query).map(formatLocationLabel) },
          { key: "startDate", label: "Start date", placeholder: "Jan 2022" },
          { key: "endDate", label: "End date", placeholder: "Present" },
          { key: "current", label: "I currently work here", type: "checkbox" },
          { key: "description", label: "Responsibilities & achievements", type: "textarea" },
        ]}
      />

      <EntryListEditor
        title="Education"
        entries={education}
        onChange={(next) => {
          setEducation(next);
          setSectionsDirty(true);
        }}
        emptyEntry={EMPTY_EDUCATION}
        emptyMessage="No education detected — add it below."
        addLabel="Add education"
        entrySummary={(e) => [e.degree, e.institution].filter(Boolean).join(" · ")}
        fields={[
          { key: "degree", label: "Degree", placeholder: "B.Tech Computer Science", suggestions: (query) => searchAutocompleteCatalog("degrees", query) },
          { key: "institution", label: "Institution", placeholder: "University name", suggestions: (query) => searchAutocompleteCatalog("institutions", query) },
          { key: "field", label: "Field of study", placeholder: "Computer Science", suggestions: (query) => searchAutocompleteCatalog("specializations", query) },
          { key: "startDate", label: "Start date", placeholder: "2018" },
          { key: "endDate", label: "End date", placeholder: "2022" },
        ]}
      />

      <EntryListEditor
        title="Projects"
        entries={projects}
        onChange={(next) => {
          setProjects(next);
          setSectionsDirty(true);
        }}
        emptyEntry={EMPTY_PROJECT}
        emptyMessage="No projects detected."
        addLabel="Add project"
        entrySummary={(e) => e.name ?? ""}
        fields={[
          { key: "name", label: "Project name" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
      />

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Certifications</h2>
        <ChipListEditor
          label="Certifications"
          values={certifications}
          onChange={(next) => {
            setCertifications(next);
            setSectionsDirty(true);
          }}
          suggestions={(query) =>
            searchAutocompleteCatalog("certifications", query)
          }
        />
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">Languages</h2>
        <ChipListEditor
          label="Languages"
          values={languages}
          onChange={(next) => {
            setLanguages(next);
            setSectionsDirty(true);
          }}
          suggestions={(query) =>
            searchAutocompleteCatalog("languages", query)
          }
        />
      </section>

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
