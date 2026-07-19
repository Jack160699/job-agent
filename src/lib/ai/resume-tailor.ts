import { z } from "zod";
import { getOpenAIClient } from "./openai-client";

export const tailoredResumeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      duration: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      year: z.string().optional(),
    })
  ),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        technologies: z.array(z.string()),
      })
    )
    .optional(),
  highlights: z.array(z.string()),
  rawText: z.string(),
});

export type TailoredResume = z.infer<typeof tailoredResumeSchema>;

export type GroundingCategory =
  | "skill"
  | "employer"
  | "job_title"
  | "employment_date"
  | "education"
  | "project"
  | "achievement"
  | "metric"
  | "responsibility"
  | "summary";

export interface GroundingReport {
  version: "grounding-v2";
  claims: Array<{
    category: GroundingCategory;
    claim: string;
    sourceResume: "Master Resume";
    sourceSection: string;
    sourceExcerpt: string | null;
    state: "SOURCE_CONFIRMED" | "AI_REWORDED" | "UNSUPPORTED";
    userConfirmed: boolean;
    aiImproved: boolean;
    reviewRequired: boolean;
  }>;
  excluded: Array<{
    category: GroundingCategory;
    claim: string;
    reasonCode:
      | "NOT_IN_MASTER"
      | "UNSUPPORTED_NUMBER"
      | "UNSUPPORTED_DATE"
      | "PROMPT_INJECTION_IGNORED";
  }>;
  acceptedCount: number;
  gaps: string[];
}

export type GroundedTailoredResume = TailoredResume & {
  groundingReport: GroundingReport;
};

interface TailorResumeInput {
  masterResume: {
    content: unknown;
    rawText: string;
    skills: string[];
  };
  job: {
    title: string;
    company: string;
    description: string;
    requiredSkills: string[];
    preferredSkills: string[];
  };
  matchAnalysis?: {
    matchedSkills: string[];
    strengths: string[];
  };
}

export async function tailorResume(
  input: TailorResumeInput
): Promise<GroundedTailoredResume> {
  if (!process.env.OPENAI_API_KEY) {
    return tailorResumeFallback(input);
  }

  const openai = getOpenAIClient();
  if (!openai) return tailorResumeFallback(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert resume writer specializing in ATS-optimized resumes.

CRITICAL RULES - NEVER VIOLATE:
1. ONLY use information that exists in the master resume
2. NEVER invent qualifications, experience, skills, or achievements
3. NEVER add companies, dates, or roles not in the original resume
4. You MAY reorder, rephrase, and emphasize relevant existing experience
5. You MAY highlight skills that match the job from the existing skill set
6. Format for ATS compatibility (simple structure, standard headings)
7. Use action verbs and quantify achievements ONLY if numbers exist in source

Return valid JSON matching the required schema.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          masterResume: input.masterResume,
          targetJob: input.job,
          emphasis: input.matchAnalysis,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = tailoredResumeSchema.parse(JSON.parse(content));
  return groundTailoredResume(parsed, input.masterResume, input.job);
}

/**
 * Drop skills/highlights that are not grounded in the master resume text.
 * Experience companies/titles that cannot be found are also removed.
 */
export function groundTailoredResume(
  tailored: TailoredResume,
  master: { rawText: string; skills: string[] },
  job?: { requiredSkills?: string[]; preferredSkills?: string[]; description?: string }
): GroundedTailoredResume {
  const haystack = `${master.rawText}\n${master.skills.join("\n")}`.toLowerCase();
  const sourceNumbers = new Set(haystack.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []);
  const stopWords = new Set([
    "and",
    "the",
    "with",
    "for",
    "from",
    "that",
    "this",
    "using",
    "into",
    "over",
    "years",
  ]);
  const excluded: GroundingReport["excluded"] = [];
  const claims: GroundingReport["claims"] = [];
  let acceptedCount = 0;
  const masterLines = master.rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sourceSection = (category: GroundingCategory) =>
    category === "employer" ||
    category === "job_title" ||
    category === "employment_date" ||
    category === "responsibility" ||
    category === "achievement" ||
    category === "metric"
      ? "Experience"
      : category === "education"
        ? "Education"
        : category === "project"
          ? "Projects"
          : category === "skill"
            ? "Skills"
            : "Summary";
  const sourceExcerpt = (value: string) => {
    const valueTokens = tokens(value);
    return (
      masterLines.find((line) => {
        const normalizedLine = line.toLowerCase();
        return (
          normalizedLine.includes(value.toLowerCase()) ||
          valueTokens.filter((token) => normalizedLine.includes(token)).length >=
            Math.max(1, Math.ceil(valueTokens.length * 0.7))
        );
      })?.slice(0, 320) ?? null
    );
  };

  const tokens = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token));

  const grounded = (
    value: string,
    category: GroundingCategory,
    minimumCoverage = 0.7
  ) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return false;
    const unsupportedNumbers = (needle.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [])
      .filter((number) => !sourceNumbers.has(number));
    if (unsupportedNumbers.length > 0) {
      claims.push({
        category: category === "employment_date" ? category : "metric",
        claim: value,
        sourceResume: "Master Resume",
        sourceSection: sourceSection(category),
        sourceExcerpt: sourceExcerpt(value),
        state: "UNSUPPORTED",
        userConfirmed: false,
        aiImproved: true,
        reviewRequired: true,
      });
      excluded.push({
        category: "metric",
        claim: value,
        reasonCode:
          category === "employment_date"
            ? "UNSUPPORTED_DATE"
            : "UNSUPPORTED_NUMBER",
      });
      return false;
    }
    if (haystack.includes(needle)) {
      acceptedCount++;
      claims.push({
        category,
        claim: value,
        sourceResume: "Master Resume",
        sourceSection: sourceSection(category),
        sourceExcerpt: sourceExcerpt(value),
        state: "SOURCE_CONFIRMED",
        userConfirmed: false,
        aiImproved: false,
        reviewRequired: false,
      });
      return true;
    }
    const claimTokens = tokens(needle);
    const coverage =
      claimTokens.length > 0
        ? claimTokens.filter((token) => haystack.includes(token)).length /
          claimTokens.length
        : 0;
    if (claimTokens.length >= 3 && coverage >= minimumCoverage) {
      acceptedCount++;
      claims.push({
        category,
        claim: value,
        sourceResume: "Master Resume",
        sourceSection: sourceSection(category),
        sourceExcerpt: sourceExcerpt(value),
        state: "AI_REWORDED",
        userConfirmed: false,
        aiImproved: true,
        reviewRequired: true,
      });
      return true;
    }
    claims.push({
      category,
      claim: value,
      sourceResume: "Master Resume",
      sourceSection: sourceSection(category),
      sourceExcerpt: sourceExcerpt(value),
      state: "UNSUPPORTED",
      userConfirmed: false,
      aiImproved: true,
      reviewRequired: true,
    });
    excluded.push({ category, claim: value, reasonCode: "NOT_IN_MASTER" });
    return false;
  };

  const skills = tailored.skills.filter((skill) => grounded(skill, "skill", 1));
  const highlights = tailored.highlights.filter((highlight) =>
    grounded(highlight, "achievement")
  );
  const experience = tailored.experience
    .filter(
      (entry) =>
        grounded(entry.company, "employer", 1) &&
        grounded(entry.title, "job_title", 1) &&
        grounded(entry.duration, "employment_date", 1)
    )
    .map((entry) => ({
      ...entry,
      bullets: entry.bullets.filter((bullet) =>
        grounded(bullet, "responsibility")
      ),
    }));
  const education = tailored.education.filter(
    (entry) =>
      grounded(entry.institution, "education", 1) &&
      grounded(entry.degree, "education", 1) &&
      (!entry.year || grounded(entry.year, "education", 1))
  );
  const projects = tailored.projects?.filter(
    (project) =>
      grounded(project.name, "project", 1) &&
      grounded(project.description, "project") &&
      project.technologies.every((technology) =>
        grounded(technology, "skill", 1)
      )
  );
  const summary = grounded(tailored.summary, "summary")
    ? tailored.summary
    : master.rawText.slice(0, 300);
  const gaps = [...(job?.requiredSkills ?? []), ...(job?.preferredSkills ?? [])]
    .filter((skill) => !haystack.includes(skill.toLowerCase()))
    .filter((skill, index, all) => all.indexOf(skill) === index)
    .slice(0, 20);

  if (
    job?.description &&
    /ignore\s+(?:all\s+)?previous instructions|system prompt|add (?:this|the) skill/i.test(
      job.description
    )
  ) {
    claims.push({
      category: "responsibility",
      claim: "Instruction embedded in job description",
      sourceResume: "Master Resume",
      sourceSection: "Job description",
      sourceExcerpt: null,
      state: "UNSUPPORTED",
      userConfirmed: false,
      aiImproved: false,
      reviewRequired: true,
    });
    excluded.push({
      category: "responsibility",
      claim: "Instruction embedded in job description",
      reasonCode: "PROMPT_INJECTION_IGNORED",
    });
  }

  return {
    ...tailored,
    summary,
    skills: skills.length > 0 ? skills : master.skills,
    highlights,
    experience,
    education,
    projects,
    // A durable resume body is always derived from the owner's master text.
    // Structured accepted changes above can be rendered separately.
    rawText: master.rawText,
    groundingReport: {
      version: "grounding-v2",
      claims,
      excluded,
      acceptedCount,
      gaps,
    },
  };
}

function tailorResumeFallback(input: TailorResumeInput): GroundedTailoredResume {
  const relevantSkills = input.masterResume.skills.filter((skill) =>
    [...input.job.requiredSkills, ...input.job.preferredSkills].some(
      (js) =>
        js.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(js.toLowerCase())
    )
  );

  return {
    title: `${input.job.title} - Tailored Resume`,
    summary: input.masterResume.rawText.slice(0, 300),
    skills: relevantSkills.length > 0 ? relevantSkills : input.masterResume.skills,
    experience: [],
    education: [],
    highlights: relevantSkills.slice(0, 5),
    rawText: input.masterResume.rawText,
    groundingReport: {
      version: "grounding-v2",
      claims: relevantSkills.map((skill) => ({
        category: "skill" as const,
        claim: skill,
        sourceResume: "Master Resume" as const,
        sourceSection: "Skills",
        sourceExcerpt:
          input.masterResume.rawText
            .split(/\r?\n/)
            .find((line) =>
              line.toLowerCase().includes(skill.toLowerCase())
            )
            ?.slice(0, 320) ?? null,
        state: "SOURCE_CONFIRMED" as const,
        userConfirmed: false,
        aiImproved: false,
        reviewRequired: false,
      })),
      excluded: [],
      acceptedCount: relevantSkills.length,
      gaps: [
        ...input.job.requiredSkills,
        ...input.job.preferredSkills,
      ].filter(
        (skill, index, all) =>
          !input.masterResume.rawText
            .toLowerCase()
            .includes(skill.toLowerCase()) && all.indexOf(skill) === index
      ),
    },
  };
}
