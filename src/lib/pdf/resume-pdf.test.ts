import { PDFDocument } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import { generateResumePdf } from "./resume-pdf";
import { RESUME_TEMPLATES } from "@/lib/resumes/templates";

const extracted = <T,>(value: T) => ({
  value,
  confidence: 1,
  source: "user_edit",
  directlyFound: true,
  needsReview: false,
});

function testProfile(): ParsedCareerProfile {
  return {
    fullName: extracted("श्रीयंश चंद्राकर"),
    email: extracted("candidate@example.com"),
    phone: extracted("+91 98765 43210"),
    currentLocation: extracted("Pune, Maharashtra"),
    professionalSummary: extracted(
      "Product engineer building reliable automation for Indian candidates."
    ),
    currentRole: extracted("Product Engineer"),
    jobTitles: extracted(["Product Engineer", "AI Engineer"]),
    experienceYears: extracted(3),
    skills: extracted(["TypeScript", "React", "PostgreSQL"]),
    experience: extracted([
      {
        title: "Product Engineer",
        company: "Kairela Labs",
        location: "Pune",
        startDate: "2023",
        endDate: null,
        current: true,
        description: "Built accessible workflows and reduced processing time by 30%.",
        evidence: "user-entered",
      },
    ]),
    education: extracted([
      {
        degree: "Master of Computer Applications",
        institution: "Pune University",
        field: "Computer Applications",
        startDate: "2020",
        endDate: "2022",
        evidence: "user-entered",
      },
    ]),
    projects: extracted([
      {
        name: "Career OS",
        description: "Created a job discovery and resume workflow.",
        technologies: ["Next.js", "Supabase"],
        evidence: "user-entered",
      },
    ]),
    certifications: extracted(["Cloud Fundamentals"]),
    languages: extracted(["English", "हिन्दी"]),
    linkedinUrl: extracted("https://www.linkedin.com/in/candidate"),
    githubUrl: extracted("https://github.com/candidate"),
    portfolioUrl: extracted("https://candidate.example.com"),
    meta: {
      extractionMethod: "deterministic",
      generatedAt: "2026-07-19T00:00:00.000Z",
    },
  };
}

async function readPdfText(bytes: Buffer): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(bytes));
  const result = await extractText(document, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}

describe("resume PDF templates", () => {
  for (const template of RESUME_TEMPLATES) {
    it(`${template.name} produces selectable, extractable resume text`, async () => {
      const pdf = await generateResumePdf({
        title: "Master Resume",
        rawText: "Fallback resume text",
        profile: testProfile(),
        template: template.id,
        length: "two-page",
      });
      const text = await readPdfText(pdf);

      expect(text).toContain("श्रीयंश चंद्राकर");
      expect(text).toContain("WORK EXPERIENCE");
      expect(text).toContain("Product Engineer");
      expect(text).toContain("Kairela Labs");
      expect(text).toContain("2023");
      expect(text).toContain("Master of Computer Applications");
      expect(text).toContain("TypeScript");
    });
  }

  it("honors one-page and two-page output limits", async () => {
    const repeatedExperience = Array.from({ length: 18 }, (_, index) => ({
      title: `Engineer ${index + 1}`,
      company: `Company ${index + 1}`,
      location: "India",
      startDate: "2020",
      endDate: "2024",
      current: false,
      description:
        "Delivered reliable systems, improved processing efficiency, and documented measurable outcomes.",
      evidence: "user-entered",
    }));
    const profile = testProfile();
    profile.experience = extracted(repeatedExperience);

    const onePage = await generateResumePdf({
      title: "Master Resume",
      rawText: "",
      profile,
      length: "one-page",
    });
    const twoPage = await generateResumePdf({
      title: "Master Resume",
      rawText: "",
      profile,
      length: "two-page",
    });

    expect((await PDFDocument.load(Uint8Array.from(onePage))).getPageCount()).toBe(1);
    expect(
      (await PDFDocument.load(Uint8Array.from(twoPage))).getPageCount()
    ).toBeLessThanOrEqual(2);
  });
});
