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
): Promise<TailoredResume> {
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

  const parsed = JSON.parse(content);
  return tailoredResumeSchema.parse(parsed);
}

function tailorResumeFallback(input: TailorResumeInput): TailoredResume {
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
  };
}
