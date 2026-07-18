"use client";

import { useState } from "react";
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
  const [professionalSummary, setProfessionalSummary] = useState(
    profile.professionalSummary.value ?? ""
  );
  const [experience, setExperience] = useState<ExperienceEntry[]>(profile.experience.value);
  const [education, setEducation] = useState<EducationEntry[]>(profile.education.value);
  const [projects, setProjects] = useState<ProjectEntry[]>(profile.projects.value);
  const [certifications, setCertifications] = useState<string[]>(profile.certifications.value);
  const [languages, setLanguages] = useState<string[]>(profile.languages.value);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/resumes/master/profile", {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Resume sections updated");
      router.refresh();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save sections"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
