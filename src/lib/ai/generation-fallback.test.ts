import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());

vi.mock("./openai-client", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create } },
  }),
}));

import { tailorResume } from "./resume-tailor";
import { generateCoverLetter } from "./cover-letter";

describe("AI document generation fallbacks", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a grounded resume when the model request fails", async () => {
    create.mockRejectedValue(new Error("provider unavailable"));

    const result = await tailorResume({
      masterResume: {
        content: {},
        rawText: "B.Tech Computer Science\nSkills: TypeScript, React",
        skills: ["TypeScript", "React"],
      },
      job: {
        title: "Software Engineer",
        company: "Example",
        description: "Build TypeScript products",
        requiredSkills: ["TypeScript"],
        preferredSkills: ["React"],
      },
    });

    expect(result.rawText).toContain("B.Tech Computer Science");
    expect(result.groundingReport.version).toBe("grounding-v2");
  });

  it("returns a truthful cover letter when model output is invalid", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: "{\"unexpected\":true}" } }],
    });

    const result = await generateCoverLetter({
      resumeText: "B.Tech Computer Science",
      job: {
        title: "Software Engineer",
        company: "Example",
        description: "Build products",
      },
    });

    expect(result.title).toContain("Example");
    expect(result.content).toContain("Software Engineer");
  });
});
