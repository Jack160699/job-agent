export const RESUME_TEMPLATE_IDS = [
  "ats-classic",
  "modern-professional",
  "technical",
  "operations-business",
  "early-career",
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATE_IDS)[number];
export type ResumeLength = "one-page" | "two-page";

export interface ResumeTemplateDefinition {
  id: ResumeTemplateId;
  name: string;
  description: string;
  accent: readonly [number, number, number];
  headingStyle: "rule" | "filled" | "label";
  sectionOrder: readonly string[];
}

export const RESUME_TEMPLATES: readonly ResumeTemplateDefinition[] = [
  {
    id: "ats-classic",
    name: "ATS Classic",
    description: "Conservative single-column layout with standard section headings.",
    accent: [0.055, 0.145, 0.29],
    headingStyle: "rule",
    sectionOrder: ["summary", "skills", "experience", "projects", "education", "certifications", "languages"],
  },
  {
    id: "modern-professional",
    name: "Modern Professional",
    description: "Crisp blue hierarchy for experienced candidates and client-facing roles.",
    accent: [0.047, 0.36, 0.78],
    headingStyle: "filled",
    sectionOrder: ["summary", "experience", "skills", "projects", "education", "certifications", "languages"],
  },
  {
    id: "technical",
    name: "Technical",
    description: "Skills and projects receive priority while retaining an ATS-safe reading order.",
    accent: [0.03, 0.23, 0.42],
    headingStyle: "label",
    sectionOrder: ["skills", "summary", "projects", "experience", "education", "certifications", "languages"],
  },
  {
    id: "operations-business",
    name: "Operations and Business",
    description: "Outcome-led structure for operations, implementation, sales, and business roles.",
    accent: [0.02, 0.32, 0.45],
    headingStyle: "rule",
    sectionOrder: ["summary", "experience", "skills", "education", "projects", "certifications", "languages"],
  },
  {
    id: "early-career",
    name: "Early Career",
    description: "Education, projects, and skills lead for freshers and career starters.",
    accent: [0.15, 0.31, 0.64],
    headingStyle: "filled",
    sectionOrder: ["summary", "education", "projects", "skills", "experience", "certifications", "languages"],
  },
] as const;

export function isResumeTemplateId(value: string | null): value is ResumeTemplateId {
  return RESUME_TEMPLATE_IDS.includes(value as ResumeTemplateId);
}

export function isResumeLength(value: string | null): value is ResumeLength {
  return value === "one-page" || value === "two-page";
}

export function getResumeTemplate(id: ResumeTemplateId): ResumeTemplateDefinition {
  return RESUME_TEMPLATES.find((template) => template.id === id) ?? RESUME_TEMPLATES[0];
}
