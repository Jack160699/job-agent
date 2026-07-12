import { z } from "zod";
import { getOpenAIClient } from "./openai-client";

export const matchAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillMatch: z.number().min(0).max(100),
  experienceMatch: z.number().min(0).max(100),
  locationMatch: z.number().min(0).max(100),
  salaryMatch: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendation: z.enum(["APPLY", "SKIP", "REVIEW"]),
  reasoning: z.string(),
});

export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;

interface MatchInput {
  resumeSkills: string[];
  resumeExperience: number;
  resumeText: string;
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceMin?: number | null;
  experienceMax?: number | null;
  location?: string | null;
  workMode?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  userPreferences?: {
    locations?: string[];
    workModes?: string[];
    salaryMin?: number | null;
    matchThreshold?: number;
  };
}

export async function calculateMatchScore(
  input: MatchInput
): Promise<MatchAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    return calculateMatchScoreFallback(input);
  }

  const openai = getOpenAIClient();
  if (!openai) return calculateMatchScoreFallback(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert career matcher. Compare a candidate's resume against a job posting.
CRITICAL RULES:
- Only match based on ACTUAL qualifications in the resume
- Never inflate scores or assume skills not present
- Be honest about gaps
- Score 0-100 where 80+ is strong match, 60-79 is moderate, below 60 is weak
Return valid JSON matching the required schema.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          resume: {
            skills: input.resumeSkills,
            experienceYears: input.resumeExperience,
            summary: input.resumeText.slice(0, 2000),
          },
          job: {
            title: input.jobTitle,
            description: input.jobDescription.slice(0, 3000),
            requiredSkills: input.requiredSkills,
            preferredSkills: input.preferredSkills,
            experienceMin: input.experienceMin,
            experienceMax: input.experienceMax,
            location: input.location,
            workMode: input.workMode,
            salaryRange: { min: input.salaryMin, max: input.salaryMax },
          },
          preferences: input.userPreferences,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content);
  return matchAnalysisSchema.parse(parsed);
}

function calculateMatchScoreFallback(input: MatchInput): MatchAnalysis {
  const resumeSkillsLower = input.resumeSkills.map((s) => s.toLowerCase());
  const requiredLower = input.requiredSkills.map((s) => s.toLowerCase());
  const preferredLower = input.preferredSkills.map((s) => s.toLowerCase());

  const matchedRequired = requiredLower.filter((s) =>
    resumeSkillsLower.some((rs) => rs.includes(s) || s.includes(rs))
  );
  const matchedPreferred = preferredLower.filter((s) =>
    resumeSkillsLower.some((rs) => rs.includes(s) || s.includes(rs))
  );

  const skillMatch =
    requiredLower.length > 0
      ? (matchedRequired.length / requiredLower.length) * 100
      : 50;

  const experienceMatch =
    input.experienceMin != null
      ? input.resumeExperience >= input.experienceMin
        ? 100
        : Math.max(0, (input.resumeExperience / input.experienceMin) * 100)
      : 75;

  const overallScore = Math.round(
    skillMatch * 0.6 + experienceMatch * 0.3 + 10
  );

  const missingSkills = requiredLower.filter(
    (s) => !resumeSkillsLower.some((rs) => rs.includes(s) || s.includes(rs))
  );

  return {
    overallScore: Math.min(100, overallScore),
    skillMatch: Math.round(skillMatch),
    experienceMatch: Math.round(experienceMatch),
    locationMatch: 75,
    salaryMatch: 75,
    matchedSkills: [...matchedRequired, ...matchedPreferred],
    missingSkills,
    strengths: matchedRequired.slice(0, 3),
    gaps: missingSkills.slice(0, 3),
    recommendation:
      overallScore >= 70 ? "APPLY" : overallScore >= 50 ? "REVIEW" : "SKIP",
    reasoning: `Matched ${matchedRequired.length}/${requiredLower.length} required skills.`,
  };
}
