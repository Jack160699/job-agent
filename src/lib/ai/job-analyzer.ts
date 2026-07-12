import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const jobSkillsSchema = z.object({
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  experienceMin: z.number().nullable(),
  experienceMax: z.number().nullable(),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"]),
  employmentType: z.enum([
    "FULL_TIME",
    "PART_TIME",
    "CONTRACT",
    "INTERNSHIP",
    "FREELANCE",
    "UNKNOWN",
  ]),
  visaSponsorship: z.boolean().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  summary: z.string(),
});

export type JobSkillsExtraction = z.infer<typeof jobSkillsSchema>;

export async function extractJobSkills(
  jobDescription: string
): Promise<JobSkillsExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    return extractJobSkillsFallback(jobDescription);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a job description analyzer. Extract structured information from job postings.
Return valid JSON only. Be precise about required vs preferred skills.`,
      },
      {
        role: "user",
        content: `Analyze this job description and extract skills, experience requirements, work mode, employment type, visa sponsorship, and salary range if mentioned:\n\n${jobDescription}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  const parsed = JSON.parse(content);
  return jobSkillsSchema.parse(parsed);
}

function extractJobSkillsFallback(description: string): JobSkillsExtraction {
  const commonSkills = [
    "JavaScript", "TypeScript", "Python", "React", "Node.js", "AWS",
    "Docker", "Kubernetes", "SQL", "PostgreSQL", "MongoDB", "Git",
    "Java", "Go", "Rust", "C++", "Machine Learning", "AI", "DevOps",
  ];

  const lowerDesc = description.toLowerCase();
  const foundSkills = commonSkills.filter((skill) =>
    lowerDesc.includes(skill.toLowerCase())
  );

  const isRemote = /remote|work from home|wfh/i.test(description);
  const isHybrid = /hybrid/i.test(description);

  return {
    requiredSkills: foundSkills.slice(0, 5),
    preferredSkills: foundSkills.slice(5),
    experienceMin: null,
    experienceMax: null,
    workMode: isRemote ? "REMOTE" : isHybrid ? "HYBRID" : "UNKNOWN",
    employmentType: "FULL_TIME",
    visaSponsorship: /visa sponsor|h-1b|work authorization/i.test(description)
      ? true
      : null,
    salaryMin: null,
    salaryMax: null,
    summary: description.slice(0, 200),
  };
}
