import { describe, expect, it } from "vitest";
import { parseResumeStructure } from "./parser";
import { extractCareerProfile } from "./career-profile";
import { ATS_SCORE_VERSION, calculateAtsReadinessScore } from "./ats-score";

const STRONG_RESUME = `Jane Doe
Senior Software Engineer | jane.doe@email.com | +1 555 123 4567 | Pune, India
https://linkedin.com/in/janedoe | https://github.com/janedoe

SUMMARY
Senior engineer with six years of experience building reliable, scalable web applications.

EXPERIENCE
Senior Software Engineer | Acme Corp | 2021 - Present
- Led a team of 4 engineers and reduced checkout latency by 35%.
- Built and launched a TypeScript service handling 2M requests/day.

Software Engineer | StartupXYZ | 2019 - 2021
- Improved test coverage from 40% to 85%, cutting production incidents by half.
- Developed React components used across 3 product lines.

EDUCATION
B.S. Computer Science | State University | 2019

SKILLS
TypeScript, React, Node.js, PostgreSQL, Docker, Kubernetes, AWS, GraphQL, CI/CD, System Design

CERTIFICATIONS
AWS Certified Solutions Architect
`;

const WEAK_RESUME = `Sam Weakling, a person who exists and is looking for any kind of job somewhere.
SKILLS
Excel
`;

function profileFor(text: string) {
  const parsed = parseResumeStructure(text, { mediaType: "text/plain", parser: "test" });
  const profile = extractCareerProfile(parsed);
  return { profile, rawText: parsed.rawText };
}

describe("calculateAtsReadinessScore", () => {
  it("is deterministic — identical input always produces an identical score", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const a = calculateAtsReadinessScore(profile, rawText);
    const b = calculateAtsReadinessScore(profile, rawText);
    // generatedAt legitimately differs; everything else must be byte-identical.
    const { generatedAt: _a, ...restA } = a;
    const { generatedAt: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  it("category scores sum exactly to the total score", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    const categorySum = Math.round(result.categories.reduce((s, c) => s + c.score, 0));
    expect(result.totalScore).toBe(categorySum);
  });

  it("category max scores sum to exactly 100", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    const maxSum = result.categories.reduce((s, c) => s + c.maxScore, 0);
    expect(maxSum).toBe(100);
  });

  it("scores a well-structured resume as Good or Strong", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    expect(result.totalScore).toBeGreaterThanOrEqual(55);
    expect(["Good", "Strong"]).toContain(result.rating);
  });

  it("scores a sparse resume low and lists missing sections / quick fixes", () => {
    const { profile, rawText } = profileFor(WEAK_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    expect(result.totalScore).toBeLessThan(55);
    expect(result.rating).toBe("Needs improvement");
    expect(result.missingSections.length).toBeGreaterThan(0);
    expect(result.quickFixes.length).toBeGreaterThan(0);
  });

  it("reduces exactly the contact-identity category when contact fields are missing", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const strong = calculateAtsReadinessScore(profile, rawText);

    const strippedProfile = {
      ...profile,
      email: { ...profile.email, value: null },
      phone: { ...profile.phone, value: null },
    };
    const stripped = calculateAtsReadinessScore(strippedProfile, rawText);

    const strongContact = strong.categories.find((c) => c.key === "contactIdentity")!.score;
    const strippedContact = stripped.categories.find((c) => c.key === "contactIdentity")!.score;
    expect(strippedContact).toBeLessThan(strongContact);

    // Every other category must be unaffected by removing only contact fields.
    for (const key of [
      "workExperienceStructure",
      "skillsClarity",
      "achievementEvidence",
      "educationCompleteness",
    ]) {
      const before = strong.categories.find((c) => c.key === key)!.score;
      const after = stripped.categories.find((c) => c.key === key)!.score;
      expect(after).toBe(before);
    }
  });

  it("never rewards unsupported claims: achievement score depends only on evidence already in the resume", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const withInventedText = calculateAtsReadinessScore(profile, rawText + "\nFABRICATED: increased revenue by 900%");
    const original = calculateAtsReadinessScore(profile, rawText);
    // Appending text to rawText without it being part of any experience
    // entry's grounded description must not change the achievement score —
    // the scorer only reads structured experience.description, never raw text scanning for numbers.
    const achievementBefore = original.categories.find((c) => c.key === "achievementEvidence")!.score;
    const achievementAfter = withInventedText.categories.find((c) => c.key === "achievementEvidence")!.score;
    expect(achievementAfter).toBe(achievementBefore);
  });

  it("flags scanned/insufficient-text resumes as a formatting risk", () => {
    const parsed = parseResumeStructure(
      "Alex Kim, a software engineer.\n\nEXPERIENCE\nEngineer at Acme, 2020 to 2022.\n\nSKILLS\nGo, Python, Rust, Cloud computing.",
      { mediaType: "text/plain", parser: "test" }
    );
    const profile = extractCareerProfile(parsed);
    const result = calculateAtsReadinessScore(profile, parsed.rawText);
    expect(result.formattingRisks).toContain("insufficient readable text");
  });

  it("flags out-of-order employment dates", () => {
    const parsed = parseResumeStructure(
      `Sam Lee\n\nEXPERIENCE\nEngineer | Acme | 2022 - 2019\n\nSKILLS\nGo, Python, Rust, Java, C++`,
      { mediaType: "text/plain", parser: "test" }
    );
    const profile = extractCareerProfile(parsed);
    const result = calculateAtsReadinessScore(profile, parsed.rawText);
    expect(result.issues.some((i) => i.toLowerCase().includes("out of order"))).toBe(true);
  });

  it("flags duplicate bullets and obvious keyword stuffing", () => {
    const repeatedBullet =
      "Built reliable payment services used by customers across India.";
    const text = `${STRONG_RESUME}
${repeatedBullet}
${repeatedBullet}
cloud cloud cloud cloud cloud cloud cloud cloud cloud cloud
cloud cloud cloud cloud cloud cloud cloud cloud cloud cloud
cloud cloud cloud cloud cloud cloud cloud cloud cloud cloud`;
    const { profile, rawText } = profileFor(text);
    const result = calculateAtsReadinessScore(profile, rawText);
    expect(result.formattingRisks).toContain("duplicate resume lines");
    expect(result.formattingRisks).toContain("possible keyword stuffing");
  });

  it("stamps the current score version", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    expect(result.scoreVersion).toBe(ATS_SCORE_VERSION);
  });

  it("total score is always within 0-100", () => {
    const { profile, rawText } = profileFor(STRONG_RESUME);
    const result = calculateAtsReadinessScore(profile, rawText);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });
});
