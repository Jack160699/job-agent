import { z } from "zod";
import { getOpenAIClient } from "./openai-client";

export const coverLetterSchema = z.object({
  title: z.string(),
  content: z.string(),
  tone: z.string(),
});

export type CoverLetter = z.infer<typeof coverLetterSchema>;

interface GenerateCoverLetterInput {
  resumeText: string;
  job: {
    title: string;
    company: string;
    description: string;
  };
  tone?: string;
  highlights?: string[];
}

export async function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<CoverLetter> {
  if (!process.env.OPENAI_API_KEY) {
    return generateCoverLetterFallback(input);
  }

  const openai = getOpenAIClient();
  if (!openai) return generateCoverLetterFallback(input);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an expert cover letter writer.

CRITICAL RULES:
1. ONLY reference qualifications and experience from the provided resume
2. NEVER invent experience, skills, or achievements
3. Be specific about why the candidate fits THIS role
4. Keep it concise (250-400 words)
5. Professional ${input.tone || "professional"} tone
6. Include a compelling opening and clear call to action

Return valid JSON with title, content, and tone fields.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          resume: input.resumeText.slice(0, 3000),
          job: input.job,
          highlights: input.highlights,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content);
  return coverLetterSchema.parse(parsed);
}

function generateCoverLetterFallback(input: GenerateCoverLetterInput): CoverLetter {
  const content = `Dear Hiring Manager,

I am writing to express my strong interest in the ${input.job.title} position at ${input.job.company}. With my background and skills outlined in my resume, I believe I would be a valuable addition to your team.

${input.highlights?.length ? `My key qualifications include: ${input.highlights.join(", ")}.` : ""}

I am excited about the opportunity to contribute to ${input.job.company} and would welcome the chance to discuss how my experience aligns with your needs.

Thank you for your consideration.

Sincerely,
[Your Name]`;

  return {
    title: `Cover Letter - ${input.job.company} - ${input.job.title}`,
    content,
    tone: input.tone || "professional",
  };
}

export async function answerApplicationQuestion(
  question: string,
  resumeText: string,
  jobContext: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "Please refer to my resume for details about my qualifications.";
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return "Please refer to my resume for details about my qualifications.";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Answer job application questions truthfully based ONLY on the resume provided.
NEVER invent qualifications. If information isn't in the resume, say so honestly.
Keep answers concise and professional.`,
      },
      {
        role: "user",
        content: `Resume:\n${resumeText.slice(0, 3000)}\n\nJob Context:\n${jobContext.slice(0, 1000)}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  return (
    response.choices[0]?.message?.content ||
    "Please refer to my resume for details."
  );
}
