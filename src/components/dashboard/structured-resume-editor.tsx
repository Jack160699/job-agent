"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChipListEditor } from "@/components/onboarding/resume-first/chip-list-editor";
import { EntryListEditor } from "@/components/onboarding/resume-first/entry-list-editor";
import type {
  EducationEntry,
  ExperienceEntry,
  ParsedCareerProfile,
  ProjectEntry,
} from "@/lib/resumes/career-profile";

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

interface StructuredResumePayload {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentLocation: string | null;
  currentRole: string | null;
  jobTitles: string[];
  skills: string[];
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  professionalSummary: string | null;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: string[];
  languages: string[];
}

function validOptionalUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Phase A, post-onboarding surface: the same structured section editing
 * available during the initial resume review, but reachable any time from
 * the Resume Manager. Saving here versions the master resume exactly like
 * a re-upload — see PATCH /api/resumes/master/profile.
 */
export function StructuredResumeEditor({
  profile,
  onSaved,
  onCancel,
}: {
  profile: ParsedCareerProfile;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile.fullName.value ?? "");
  const [email, setEmail] = useState(profile.email.value ?? "");
  const [phone, setPhone] = useState(profile.phone.value ?? "");
  const [currentLocation, setCurrentLocation] = useState(
    profile.currentLocation.value ?? ""
  );
  const [currentRole, setCurrentRole] = useState(profile.currentRole.value ?? "");
  const [jobTitles, setJobTitles] = useState<string[]>(profile.jobTitles.value);
  const [skills, setSkills] = useState<string[]>(profile.skills.value);
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl.value ?? "");
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl.value ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(
    profile.portfolioUrl.value ?? ""
  );
  const [professionalSummary, setProfessionalSummary] = useState(
    profile.professionalSummary.value ?? ""
  );
  const [experience, setExperience] = useState<ExperienceEntry[]>(profile.experience.value);
  const [education, setEducation] = useState<EducationEntry[]>(profile.education.value);
  const [projects, setProjects] = useState<ProjectEntry[]>(profile.projects.value);
  const [certifications, setCertifications] = useState<string[]>(profile.certifications.value);
  const [languages, setLanguages] = useState<string[]>(profile.languages.value);

  const payload = useMemo<StructuredResumePayload>(
    () => ({
      fullName: fullName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      currentLocation: currentLocation.trim() || null,
      currentRole: currentRole.trim() || null,
      jobTitles,
      skills,
      linkedinUrl: linkedinUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      portfolioUrl: portfolioUrl.trim() || null,
      professionalSummary: professionalSummary.trim() || null,
      experience,
      education,
      projects,
      certifications,
      languages,
    }),
    [
      certifications,
      currentLocation,
      currentRole,
      education,
      email,
      experience,
      fullName,
      githubUrl,
      jobTitles,
      languages,
      linkedinUrl,
      phone,
      portfolioUrl,
      professionalSummary,
      projects,
      skills,
    ]
  );
  const payloadJson = useMemo(() => JSON.stringify(payload), [payload]);
  const [savedSnapshot, setSavedSnapshot] = useState(payloadJson);
  const dirty = payloadJson !== savedSnapshot;
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Enter a valid email address.");
    }
    if (!validOptionalUrl(linkedinUrl)) errors.push("Enter a valid LinkedIn URL.");
    if (!validOptionalUrl(githubUrl)) errors.push("Enter a valid GitHub URL.");
    if (!validOptionalUrl(portfolioUrl)) errors.push("Enter a valid portfolio URL.");
    return errors;
  }, [email, githubUrl, linkedinUrl, portfolioUrl]);

  const save = useCallback(async (closeAfterSave: boolean) => {
    if (savingRef.current || validationErrors.length > 0) return;
    const snapshotBeingSaved = payloadJson;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/resumes/master/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: snapshotBeingSaved,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedSnapshot(snapshotBeingSaved);
      setLastSavedAt(new Date());
      router.refresh();
      if (closeAfterSave) {
        toast.success("Resume sections updated");
        onSaved();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      setSaveError(message);
      if (closeAfterSave) toast.error(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [onSaved, payloadJson, router, validationErrors.length]);

  useEffect(() => {
    if (!dirty || validationErrors.length > 0 || saving) return;
    const timeout = window.setTimeout(() => {
      void save(false);
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [dirty, save, saving, validationErrors.length]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const restoreSnapshot = () => {
    const previous = JSON.parse(savedSnapshot) as StructuredResumePayload;
    setFullName(previous.fullName ?? "");
    setEmail(previous.email ?? "");
    setPhone(previous.phone ?? "");
    setCurrentLocation(previous.currentLocation ?? "");
    setCurrentRole(previous.currentRole ?? "");
    setJobTitles(previous.jobTitles);
    setSkills(previous.skills);
    setLinkedinUrl(previous.linkedinUrl ?? "");
    setGithubUrl(previous.githubUrl ?? "");
    setPortfolioUrl(previous.portfolioUrl ?? "");
    setProfessionalSummary(previous.professionalSummary ?? "");
    setExperience(previous.experience);
    setEducation(previous.education);
    setProjects(previous.projects);
    setCertifications(previous.certifications);
    setLanguages(previous.languages);
    setSaveError(null);
  };

  const cancel = () => {
    if (
      dirty &&
      !window.confirm("Discard the changes that have not been autosaved yet?")
    ) {
      return;
    }
    onCancel();
  };

  const completenessChecks = [
    payload.fullName,
    payload.email,
    payload.phone,
    payload.currentLocation,
    payload.currentRole,
    payload.professionalSummary,
    payload.skills.length > 0,
    payload.experience.length > 0,
    payload.education.length > 0,
  ];
  const completeness = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100
  );
  const reviewRequired = Object.values(profile).filter(
    (field) =>
      field &&
      typeof field === "object" &&
      "needsReview" in field &&
      field.needsReview === true
  ).length;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-[var(--rf-surface-soft)] p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--rf-ink-tertiary)]">Profile completeness</p>
            <p className="mt-1 text-lg font-semibold text-[var(--rf-ink)]">
              {completeness}%
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--rf-ink-tertiary)]">Fields to review</p>
            <p className="mt-1 text-lg font-semibold text-[var(--rf-ink)]">
              {reviewRequired}
            </p>
          </div>
          <div aria-live="polite">
            <p className="text-xs text-[var(--rf-ink-tertiary)]">Autosave</p>
            <p className="mt-1 text-sm font-medium text-[var(--rf-ink)]">
              {saving
                ? "Saving…"
                : validationErrors.length > 0
                  ? "Fix validation errors"
                  : dirty
                    ? "Unsaved changes"
                    : lastSavedAt
                      ? `Saved ${lastSavedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "All changes saved"}
            </p>
          </div>
        </div>
      </section>

      {(validationErrors.length > 0 || saveError) && (
        <div
          role="alert"
          className="rounded-[var(--rf-radius-sm)] border border-[var(--error)]/25 bg-[var(--error-muted)] p-3 text-xs text-[var(--error)]"
        >
          <p className="font-semibold">Review these fields before saving</p>
          {validationErrors.map((error) => (
            <p key={error} className="mt-1">
              {error}
            </p>
          ))}
          {saveError && <p className="mt-1">{saveError}</p>}
        </div>
      )}

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">
          Personal details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Full name", fullName, setFullName, "Your full name"],
            ["Email", email, setEmail, "you@example.com"],
            ["Phone", phone, setPhone, "+91 98765 43210"],
            [
              "Current location",
              currentLocation,
              setCurrentLocation,
              "Pune, Maharashtra",
            ],
          ].map(([label, value, setter, placeholder]) => {
            const id = `resume-${String(label).toLowerCase().replaceAll(" ", "-")}`;
            return (
              <div key={String(label)} className="space-y-1">
                <label htmlFor={id} className="text-xs text-[var(--rf-ink-tertiary)]">
                  {String(label)}
                </label>
                <input
                  id={id}
                  type={label === "Email" ? "email" : "text"}
                  className="h-11 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 text-sm text-[var(--rf-ink)]"
                  value={String(value)}
                  placeholder={String(placeholder)}
                  onChange={(event) =>
                    (setter as React.Dispatch<React.SetStateAction<string>>)(
                      event.target.value
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">
          Career direction
        </h2>
        <div className="space-y-1">
          <label htmlFor="resume-current-role" className="text-xs text-[var(--rf-ink-tertiary)]">
            Current role
          </label>
          <input
            id="resume-current-role"
            className="h-11 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 text-sm text-[var(--rf-ink)]"
            value={currentRole}
            onChange={(event) => setCurrentRole(event.target.value)}
          />
        </div>
        <ChipListEditor
          label="Target job titles"
          values={jobTitles}
          onChange={setJobTitles}
        />
        <ChipListEditor label="Skills" values={skills} onChange={setSkills} />
      </section>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--ink)]">Headline / summary</p>
        <textarea
          className="min-h-20 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)]"
          value={professionalSummary}
          onChange={(e) => setProfessionalSummary(e.target.value)}
        />
      </div>

      <EntryListEditor
        title="Work experience"
        entries={experience}
        onChange={setExperience}
        emptyEntry={EMPTY_EXPERIENCE}
        addLabel="Add role"
        entrySummary={(e) => [e.title, e.company].filter(Boolean).join(" · ")}
        fields={[
          { key: "title", label: "Title", placeholder: "Software Engineer" },
          { key: "company", label: "Company", placeholder: "Acme Inc" },
          { key: "location", label: "Location", placeholder: "Pune, India" },
          { key: "startDate", label: "Start date", placeholder: "Jan 2022" },
          { key: "endDate", label: "End date", placeholder: "Present" },
          { key: "current", label: "I currently work here", type: "checkbox" },
          { key: "description", label: "Responsibilities & achievements", type: "textarea" },
        ]}
      />

      <EntryListEditor
        title="Education"
        entries={education}
        onChange={setEducation}
        addLabel="Add education"
        emptyEntry={EMPTY_EDUCATION}
        entrySummary={(e) => [e.degree, e.institution].filter(Boolean).join(" · ")}
        fields={[
          { key: "degree", label: "Degree", placeholder: "B.Tech Computer Science" },
          { key: "institution", label: "Institution", placeholder: "University name" },
          { key: "field", label: "Field of study" },
          { key: "startDate", label: "Start date", placeholder: "2018" },
          { key: "endDate", label: "End date", placeholder: "2022" },
        ]}
      />

      <EntryListEditor
        title="Projects"
        entries={projects}
        onChange={setProjects}
        addLabel="Add project"
        emptyEntry={EMPTY_PROJECT}
        entrySummary={(e) => e.name ?? ""}
        fields={[
          { key: "name", label: "Project name" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
      />

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--ink)]">Certifications</p>
        <ChipListEditor label="Certifications" values={certifications} onChange={setCertifications} />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--ink)]">Languages</p>
        <ChipListEditor label="Languages" values={languages} onChange={setLanguages} />
      </div>

      <section className="space-y-3 rounded-[var(--rf-radius)] border border-[var(--rf-line)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--rf-ink)]">
          Professional links
        </h2>
        {[
          ["LinkedIn URL", linkedinUrl, setLinkedinUrl],
          ["GitHub URL", githubUrl, setGithubUrl],
          ["Portfolio URL", portfolioUrl, setPortfolioUrl],
        ].map(([label, value, setter]) => {
          const id = `resume-${String(label).toLowerCase().replaceAll(" ", "-")}`;
          return (
            <div key={String(label)} className="space-y-1">
              <label htmlFor={id} className="text-xs text-[var(--rf-ink-tertiary)]">
                {String(label)}
              </label>
              <input
                id={id}
                type="url"
                className="h-11 w-full rounded-[var(--rf-radius-sm)] border border-[var(--rf-line)] bg-white px-3 text-sm text-[var(--rf-ink)]"
                value={String(value)}
                placeholder="https://"
                onChange={(event) =>
                  (setter as React.Dispatch<React.SetStateAction<string>>)(
                    event.target.value
                  )
                }
              />
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          disabled={saving || validationErrors.length > 0}
          onClick={() => void save(true)}
        >
          {saving ? "Saving…" : "Save all"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving || !dirty}
          onClick={restoreSnapshot}
        >
          Undo unsaved changes
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
