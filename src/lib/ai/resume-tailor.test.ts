import { describe, expect, it } from "vitest";
import { groundTailoredResume } from "@/lib/ai/resume-tailor";

describe("groundTailoredResume", () => {
  it("removes invented skills and highlights", () => {
    const grounded = groundTailoredResume(
      {
        title: "Backend Engineer - Tailored Resume",
        summary: "Experienced engineer",
        skills: ["TypeScript", "Kubernetes"],
        experience: [
          {
            company: "Acme",
            title: "Engineer",
            duration: "2022-2024",
            bullets: ["Built TypeScript services", "Led quantum computing lab"],
          },
        ],
        education: [],
        highlights: ["TypeScript expert", "PhD in Physics"],
        rawText: "TypeScript engineer at Acme",
      },
      {
        rawText:
          "Engineer at Acme. Built TypeScript services for payments platforms.",
        skills: ["TypeScript"],
      }
    );

    expect(grounded.skills).toEqual(["TypeScript"]);
    expect(grounded.highlights).toEqual([]);
    expect(grounded.experience[0]?.bullets).toEqual([
      "Built TypeScript services",
    ]);
  });
});
