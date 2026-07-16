import type { ParsedResume } from "./parser";

/**
 * A single extracted field with provenance so the review UI can show
 * confidence and let the user confirm or correct it. Never populate `value`
 * with anything not grounded in the source resume text.
 */
export interface ExtractedField<T> {
  value: T;
  confidence: number; // 0..1
  source: string | null; // section heading or short evidence snippet
  directlyFound: boolean;
  needsReview: boolean;
}

export interface ExperienceEntry {
  title: string | null;
  company: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string | null;
  evidence: string;
}

export interface EducationEntry {
  degree: string | null;
  institution: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
  evidence: string;
}

export interface ProjectEntry {
  name: string | null;
  description: string | null;
  technologies: string[];
  evidence: string;
}

export interface ParsedCareerProfile {
  fullName: ExtractedField<string | null>;
  email: ExtractedField<string | null>;
  phone: ExtractedField<string | null>;
  currentLocation: ExtractedField<string | null>;
  professionalSummary: ExtractedField<string | null>;
  currentRole: ExtractedField<string | null>;
  jobTitles: ExtractedField<string[]>;
  experienceYears: ExtractedField<number | null>;
  skills: ExtractedField<string[]>;
  experience: ExtractedField<ExperienceEntry[]>;
  education: ExtractedField<EducationEntry[]>;
  projects: ExtractedField<ProjectEntry[]>;
  certifications: ExtractedField<string[]>;
  languages: ExtractedField<string[]>;
  linkedinUrl: ExtractedField<string | null>;
  githubUrl: ExtractedField<string | null>;
  portfolioUrl: ExtractedField<string | null>;
  meta: {
    extractionMethod: "deterministic" | "hybrid";
    generatedAt: string;
  };
}

function field<T>(
  value: T,
  opts: Partial<Pick<ExtractedField<T>, "confidence" | "source" | "directlyFound" | "needsReview">> = {}
): ExtractedField<T> {
  return {
    value,
    confidence: opts.confidence ?? 0,
    source: opts.source ?? null,
    directlyFound: opts.directlyFound ?? false,
    needsReview: opts.needsReview ?? false,
  };
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function findSection(
  sections: ParsedResume["content"]["sections"],
  names: string[]
): { heading: string; text: string } | undefined {
  const lower = names.map((n) => n.toLowerCase());
  return sections.find((s) => lower.includes(s.heading.toLowerCase()));
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const LINKEDIN_RE = /https?:\/\/(www\.)?linkedin\.com\/[^\s,)]+/i;
const GITHUB_RE = /https?:\/\/(www\.)?github\.com\/[^\s,)]+/i;
const GENERIC_URL_RE = /https?:\/\/[^\s,)]+/gi;
const YEARS_EXPLICIT_RE = /(\d{1,2})\+?\s*years?(\s+of)?\s+(experience|exp\b)/i;
const DATE_RANGE_RE =
  /(\b[A-Z][a-z]{2,8}\.?\s+\d{4}|\d{4})\s*(?:-|–|—|to)\s*(present|current|now|\b[A-Z][a-z]{2,8}\.?\s+\d{4}|\d{4})/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;

function extractPersonalDetails(
  rawText: string
): Pick<
  ParsedCareerProfile,
  "fullName" | "email" | "phone" | "currentLocation" | "linkedinUrl" | "githubUrl" | "portfolioUrl"
> {
  const emailMatch = rawText.match(EMAIL_RE);
  const phoneMatch = rawText.match(PHONE_RE);
  const linkedinMatch = rawText.match(LINKEDIN_RE);
  const githubMatch = rawText.match(GITHUB_RE);

  const allUrls = rawText.match(GENERIC_URL_RE) ?? [];
  const portfolioUrl = allUrls.find(
    (u) => !/linkedin\.com/i.test(u) && !/github\.com/i.test(u)
  );

  const firstLine = rawText.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const looksLikeName =
    firstLine.length > 0 &&
    firstLine.length <= 60 &&
    !EMAIL_RE.test(firstLine) &&
    /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(firstLine);

  const headerLine = rawText.split("\n").slice(0, 4).find((l) => /,\s*[A-Za-z]/.test(l) && l.length < 80);
  const locationMatch = headerLine?.match(/([A-Za-z .'-]+,\s*[A-Za-z .'-]{2,})/);

  return {
    fullName: looksLikeName
      ? field(firstLine, { confidence: 0.6, source: "header", directlyFound: true, needsReview: true })
      : field(null),
    email: emailMatch
      ? field(emailMatch[0], { confidence: 0.95, source: "header", directlyFound: true })
      : field(null),
    phone: phoneMatch
      ? field(phoneMatch[0].trim(), { confidence: 0.7, source: "header", directlyFound: true, needsReview: true })
      : field(null),
    currentLocation: locationMatch
      ? field(locationMatch[1].trim(), {
          confidence: 0.5,
          source: "header",
          directlyFound: true,
          needsReview: true,
        })
      : field(null),
    linkedinUrl: linkedinMatch
      ? field(linkedinMatch[0], { confidence: 0.9, source: "header", directlyFound: true })
      : field(null),
    githubUrl: githubMatch
      ? field(githubMatch[0], { confidence: 0.9, source: "header", directlyFound: true })
      : field(null),
    portfolioUrl: portfolioUrl
      ? field(portfolioUrl, { confidence: 0.6, source: "header", directlyFound: true, needsReview: true })
      : field(null),
  };
}

function parseEntryLines(text: string): string[][] {
  // Groups a section's lines into entries: a "header" line (containing " | " or " at ")
  // followed by bullet/description lines until the next header line.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups: string[][] = [];
  for (const line of lines) {
    const isHeader = / \| .+ \| /.test(line) || /^[A-Za-z].+\bat\b.+/.test(line) && !line.startsWith("-");
    if (isHeader || groups.length === 0) {
      groups.push([line]);
    } else {
      groups[groups.length - 1].push(line);
    }
  }
  return groups;
}

function extractExperience(
  sections: ParsedResume["content"]["sections"]
): ExtractedField<ExperienceEntry[]> {
  const section = findSection(sections, ["experience", "work experience", "employment"]);
  if (!section) return field([]);

  const groups = parseEntryLines(section.text);
  const entries: ExperienceEntry[] = groups.map((lines) => {
    const header = lines[0];
    const description = lines.slice(1).join(" ").trim() || null;
    const dateMatch = header.match(DATE_RANGE_RE);
    const current = /present|current|now/i.test(dateMatch?.[2] ?? "");

    if (header.includes(" | ")) {
      const parts = header.split("|").map((p) => p.trim());
      return {
        title: parts[0] || null,
        company: parts[1] || null,
        location: null,
        startDate: dateMatch?.[1] ?? null,
        endDate: current ? "Present" : dateMatch?.[2] ?? null,
        current,
        description,
        evidence: header,
      };
    }

    const atMatch = header.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      return {
        title: atMatch[1].trim(),
        company: atMatch[2].replace(DATE_RANGE_RE, "").trim() || null,
        location: null,
        startDate: dateMatch?.[1] ?? null,
        endDate: current ? "Present" : dateMatch?.[2] ?? null,
        current,
        description,
        evidence: header,
      };
    }

    return {
      title: header || null,
      company: null,
      location: null,
      startDate: dateMatch?.[1] ?? null,
      endDate: current ? "Present" : dateMatch?.[2] ?? null,
      current,
      description,
      evidence: header,
    };
  });

  return field(entries, {
    confidence: entries.length ? 0.7 : 0,
    source: section.heading,
    directlyFound: entries.length > 0,
    needsReview: entries.some((e) => !e.title || !e.company),
  });
}

function extractEducation(
  sections: ParsedResume["content"]["sections"]
): ExtractedField<EducationEntry[]> {
  const section = findSection(sections, ["education"]);
  if (!section) return field([]);

  const lines = section.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: EducationEntry[] = lines.map((line) => {
    const yearMatch = line.match(YEAR_RE);
    if (line.includes(" | ")) {
      const parts = line.split("|").map((p) => p.trim());
      return {
        degree: parts[0] || null,
        institution: parts[1] || null,
        field: null,
        startDate: null,
        endDate: yearMatch?.[0] ?? parts[2] ?? null,
        evidence: line,
      };
    }
    return {
      degree: line || null,
      institution: null,
      field: null,
      startDate: null,
      endDate: yearMatch?.[0] ?? null,
      evidence: line,
    };
  });

  return field(entries, {
    confidence: entries.length ? 0.65 : 0,
    source: section.heading,
    directlyFound: entries.length > 0,
    needsReview: entries.some((e) => !e.institution),
  });
}

function extractProjects(
  sections: ParsedResume["content"]["sections"]
): ExtractedField<ProjectEntry[]> {
  const section = findSection(sections, ["projects"]);
  if (!section) return field([]);

  const groups = parseEntryLines(section.text);
  const entries: ProjectEntry[] = groups.map((lines) => {
    const header = lines[0];
    const description = lines.slice(1).join(" ").trim() || null;
    const name = header.split("|")[0]?.trim() || header || null;
    return { name, description, technologies: [], evidence: header };
  });

  return field(entries, {
    confidence: entries.length ? 0.6 : 0,
    source: section.heading,
    directlyFound: entries.length > 0,
    needsReview: true,
  });
}

function extractListSection(
  sections: ParsedResume["content"]["sections"],
  names: string[]
): ExtractedField<string[]> {
  const section = findSection(sections, names);
  if (!section) return field([]);
  const items = section.text
    .split(/\n|,/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const deduped = Array.from(new Set(items));
  return field(deduped, {
    confidence: deduped.length ? 0.7 : 0,
    source: section.heading,
    directlyFound: deduped.length > 0,
  });
}

function extractExperienceYears(
  rawText: string,
  experience: ExperienceEntry[]
): ExtractedField<number | null> {
  const explicit = rawText.match(YEARS_EXPLICIT_RE);
  if (explicit) {
    return field(parseInt(explicit[1], 10), {
      confidence: 0.9,
      source: "explicit statement",
      directlyFound: true,
    });
  }

  const years = experience
    .flatMap((e) => [e.startDate, e.current ? new Date().getFullYear().toString() : e.endDate])
    .filter((d): d is string => Boolean(d))
    .map((d) => {
      const m = d.match(YEAR_RE);
      return m ? parseInt(m[0], 10) : null;
    })
    .filter((y): y is number => y != null);

  if (years.length < 2) return field(null);

  const min = Math.min(...years);
  const max = Math.max(...years);
  const span = max - min;
  if (span <= 0 || span > 60) return field(null);

  return field(span, {
    confidence: 0.4,
    source: "computed from date ranges",
    directlyFound: false,
    needsReview: true,
  });
}

function dedupeTitles(currentRoleTitle: string | null, experience: ExperienceEntry[]): string[] {
  const titles = experience.map((e) => e.title).filter((t): t is string => Boolean(t));
  if (currentRoleTitle) titles.unshift(currentRoleTitle);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of titles) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(t.trim());
  }
  return result;
}

/**
 * Deterministic, grounded career-profile extraction. Every populated value is
 * traceable to text present in the resume — missing information stays null
 * or empty rather than being inferred or invented.
 */
export function extractCareerProfile(parsed: ParsedResume): ParsedCareerProfile {
  const { rawText, skills, content } = parsed;
  const { sections } = content;

  const personal = extractPersonalDetails(rawText);
  const experience = extractExperience(sections);
  const education = extractEducation(sections);
  const projects = extractProjects(sections);
  const certifications = extractListSection(sections, ["certifications", "certificates"]);
  const languages = extractListSection(sections, ["languages"]);
  const summarySection = findSection(sections, ["summary", "profile"]);

  const currentRoleEntry = experience.value.find((e) => e.current) ?? experience.value[0];
  const currentRole = currentRoleEntry?.title
    ? field(currentRoleEntry.title, {
        confidence: 0.6,
        source: "experience",
        directlyFound: true,
        needsReview: !currentRoleEntry.current,
      })
    : field(null);

  const jobTitles = dedupeTitles(currentRole.value, experience.value);

  return {
    ...personal,
    professionalSummary: summarySection
      ? field(summarySection.text.trim(), {
          confidence: 0.8,
          source: summarySection.heading,
          directlyFound: true,
        })
      : field(null),
    currentRole,
    jobTitles: field(jobTitles, {
      confidence: jobTitles.length ? 0.6 : 0,
      source: "experience",
      directlyFound: jobTitles.length > 0,
    }),
    experienceYears: extractExperienceYears(rawText, experience.value),
    skills: field(Array.from(new Set(skills)), {
      confidence: skills.length ? 0.85 : 0,
      source: "skills",
      directlyFound: skills.length > 0,
    }),
    experience,
    education,
    projects,
    certifications,
    languages,
    meta: {
      extractionMethod: "deterministic",
      generatedAt: new Date().toISOString(),
    },
  };
}

/** True if every non-empty value in the profile is traceable to the raw resume text. */
export function isCareerProfileGrounded(profile: ParsedCareerProfile, rawText: string): boolean {
  const haystack = rawText.toLowerCase();
  const check = (value: unknown): boolean => {
    if (isEmpty(value)) return true;
    if (typeof value === "string") return haystack.includes(value.toLowerCase().slice(0, 40));
    if (Array.isArray(value)) return value.every((v) => check(v));
    if (typeof value === "object" && value !== null) {
      return Object.values(value).every((v) => check(v));
    }
    return true;
  };

  const scalarFields: Array<keyof ParsedCareerProfile> = [
    "fullName",
    "email",
    "phone",
    "currentLocation",
    "professionalSummary",
    "currentRole",
    "jobTitles",
    "skills",
    "certifications",
    "languages",
    "linkedinUrl",
    "githubUrl",
    "portfolioUrl",
  ];

  return scalarFields.every((key) => {
    const wrapped = profile[key] as ExtractedField<unknown>;
    return check(wrapped.value);
  });
}
