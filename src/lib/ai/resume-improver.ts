import { z } from "zod";
import { getOpenAIClient } from "./openai-client";

export const resumeImprovementSchema = z.object({
  suggestions: z.array(
    z.object({
      category: z.enum([
        "SKILLS",
        "EXPERIENCE",
        "EDUCATION",
        "FORMAT",
        "KEYWORDS",
        "ACHIEVEMENTS",
      ]),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      suggestion: z.string(),
      rationale: z.string(),
    })
  ),
  missingKeywords: z.array(z.string()),
  overallAssessment: z.string(),
});

export type ResumeImprovement = z.infer<typeof resumeImprovementSchema>;

export async function suggestResumeImprovements(
  resumeText: string,
  recentJobDescriptions: string[]
): Promise<ResumeImprovement> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      suggestions: [
        {
          category: "KEYWORDS",
          priority: "MEDIUM",
          suggestion: "Add more industry-specific keywords from target job descriptions",
          rationale: "ATS systems scan for keyword matches",
        },
      ],
      missingKeywords: [],
      overallAssessment: "Configure OpenAI API key for detailed resume analysis.",
    };
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return {
      suggestions: [],
      missingKeywords: [],
      overallAssessment: "Configure OpenAI API key for detailed resume analysis.",
    };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a career coach analyzing resumes for improvement.
Suggest ONLY truthful improvements - never suggest adding fake experience.
Focus on: better phrasing, missing keywords from job market, format improvements, quantifying existing achievements.
Return valid JSON.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          resume: resumeText.slice(0, 4000),
          targetJobs: recentJobDescriptions.map((d) => d.slice(0, 500)),
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  return resumeImprovementSchema.parse(JSON.parse(content));
}
