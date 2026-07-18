import { Briefcase, GraduationCap, MapPin } from "lucide-react";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";

function formatRange(start: string | null, end: string | null, current: boolean) {
  const from = start ?? "";
  const to = current ? "Present" : (end ?? "");
  if (!from && !to) return null;
  return [from, to].filter(Boolean).join(" – ");
}

/**
 * Read-only structured overview of the master resume — the default thing
 * shown in Resume Manager instead of a collapsed plain-text paragraph.
 * "Edit sections" still opens the full StructuredResumeEditor form; this is
 * purely the at-a-glance scan view.
 */
export function ResumeProfileSummary({ profile }: { profile: ParsedCareerProfile }) {
  const experience = profile.experience.value.slice(0, 3);
  const moreExperience = profile.experience.value.length - experience.length;
  const education = profile.education.value.slice(0, 2);
  const moreEducation = profile.education.value.length - education.length;
  const skills = profile.skills.value.slice(0, 12);
  const moreSkills = profile.skills.value.length - skills.length;

  return (
    <div className="space-y-4">
      <div>
        {profile.currentRole.value && (
          <p className="text-sm font-semibold text-[var(--ink)]">{profile.currentRole.value}</p>
        )}
        {profile.currentLocation.value && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-tertiary)]">
            <MapPin className="h-3 w-3" />
            {profile.currentLocation.value}
          </p>
        )}
        {profile.professionalSummary.value && (
          <p className="mt-2 line-clamp-3 text-sm text-[var(--ink-secondary)]">
            {profile.professionalSummary.value}
          </p>
        )}
      </div>

      {experience.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-tertiary)]">
            <Briefcase className="h-3 w-3" />
            Experience
          </p>
          <div className="space-y-1.5">
            {experience.map((exp, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-[var(--ink)]">{exp.title ?? "Untitled role"}</span>
                {exp.company && (
                  <span className="text-[var(--ink-tertiary)]"> · {exp.company}</span>
                )}
                {formatRange(exp.startDate, exp.endDate, exp.current) && (
                  <span className="ml-1.5 text-xs text-[var(--ink-tertiary)]">
                    {formatRange(exp.startDate, exp.endDate, exp.current)}
                  </span>
                )}
              </div>
            ))}
            {moreExperience > 0 && (
              <p className="text-xs text-[var(--ink-tertiary)]">+{moreExperience} more</p>
            )}
          </div>
        </div>
      )}

      {education.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-tertiary)]">
            <GraduationCap className="h-3 w-3" />
            Education
          </p>
          <div className="space-y-1.5">
            {education.map((edu, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-[var(--ink)]">{edu.degree ?? "Degree"}</span>
                {edu.institution && (
                  <span className="text-[var(--ink-tertiary)]"> · {edu.institution}</span>
                )}
              </div>
            ))}
            {moreEducation > 0 && (
              <p className="text-xs text-[var(--ink-tertiary)]">+{moreEducation} more</p>
            )}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-[var(--accent-muted)] px-2.5 py-0.5 text-xs text-[var(--accent)]"
            >
              {skill}
            </span>
          ))}
          {moreSkills > 0 && (
            <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-0.5 text-xs text-[var(--ink-tertiary)]">
              +{moreSkills} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
