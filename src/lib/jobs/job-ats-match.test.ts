import { describe, expect, it } from "vitest";
import { parseResumeStructure } from "@/lib/resumes/parser";
import { extractCareerProfile } from "@/lib/resumes/career-profile";
import { calculateJobAtsMatch, JOB_ATS_MATCH_VERSION, type JobAtsMatchInput } from "./job-ats-match";

const RESUME_TEXT = `Jane Doe
Senior Software Engineer | jane.doe@email.com | Pune, India

SUMMARY
Senior engineer with six years of experience building scalable backend systems.

EXPERIENCE
Senior Software Engineer | Acme Corp | 2019 - Present
- Led migration of payment services to TypeScript and Node.js, improving reliability by 40%.
- Designed REST and GraphQL APIs backed by PostgreSQL and Redis.

Software Engineer | StartupXYZ | 2017 - 2019
- Built React frontend components and Docker-based deployment pipelines.

EDUCATION
B.S. Computer Science | State University | 2017

SKILLS
TypeScript, Node.js, React, PostgreSQL, Redis, Docker, GraphQL, AWS, Kubernetes, System Design
`;

function profile() {
  const parsed = parseResumeStructure(RESUME_TEXT, { mediaType: "text/plain", parser: "test" });
  return extractCareerProfile(parsed);
}

function job(overrides: Partial<JobAtsMatchInput> = {}): JobAtsMatchInput {
  return {
    title: "Senior Backend Engineer",
    company: "Acme",
    description:
      "We need a senior backend engineer with TypeScript, Node.js, PostgreSQL and AWS experience. Bachelor's degree preferred. You will design APIs and lead reliability improvements.",
    requiredSkills: ["TypeScript", "Node.js", "PostgreSQL"],
    preferredSkills: ["AWS", "Kubernetes"],
    experienceMin: 4,
    experienceMax: 8,
    workMode: "REMOTE",
    location: "Bengaluru, India",
    ...overrides,
  };
}

describe("calculateJobAtsMatch", () => {
  it("is deterministic — identical input always produces an identical score", () => {
    const p = profile();
    const j = job();
    const a = calculateJobAtsMatch(p, j, 0.9);
    const b = calculateJobAtsMatch(p, j, 0.9);
    expect({ ...a, generatedAt: b.generatedAt }).toEqual(b);
  });

  it("category scores sum to the total (no hard blockers)", () => {
    const result = calculateJobAtsMatch(profile(), job(), 0.9);
    const categorySum = Math.round(result.categories.reduce((s, c) => s + c.score, 0));
    expect(result.hardBlockers).toHaveLength(0);
    expect(result.totalScore).toBe(categorySum);
  });

  it("category max scores sum to exactly 100", () => {
    const result = calculateJobAtsMatch(profile(), job(), 0.9);
    const maxSum = result.categories.reduce((s, c) => s + c.maxScore, 0);
    expect(maxSum).toBe(100);
  });

  it("scores a strong match highly and lists matched skills", () => {
    const result = calculateJobAtsMatch(profile(), job(), 0.9);
    expect(result.totalScore).toBeGreaterThanOrEqual(70);
    expect(result.matchingSkills).toEqual(expect.arrayContaining(["TypeScript", "Node.js", "PostgreSQL"]));
  });

  it("applies a hard blocker when none of the required skills match, capping the score", () => {
    const mismatchedJob = job({
      requiredSkills: ["Java", "Spring Boot", "Kafka"],
      preferredSkills: [],
      description: "We need a Java Spring Boot Kafka engineer.",
    });
    const result = calculateJobAtsMatch(profile(), mismatchedJob, 0.9);
    expect(result.hardBlockers.length).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(40);
    expect(result.recommendedAction).toMatch(/not eligible/i);
  });

  it("applies a hard blocker when experience falls far short of the requirement", () => {
    const seniorJob = job({ experienceMin: 25, experienceMax: 30 });
    const result = calculateJobAtsMatch(profile(), seniorJob, 0.9);
    expect(result.hardBlockers.some((b) => b.toLowerCase().includes("25"))).toBe(true);
    expect(result.totalScore).toBeLessThanOrEqual(40);
  });

  it("never awards required-skill credit for a skill absent from the resume (no keyword stuffing)", () => {
    const p = profile();
    const j = job({ requiredSkills: ["TypeScript", "Rust", "Elixir"] });
    const result = calculateJobAtsMatch(p, j, 0.9);
    expect(result.missingRequirements).toEqual(expect.arrayContaining(["Rust", "Elixir"]));
    // Rust/Elixir are not on the resume — the required-skill category must be < full marks.
    const requiredCategory = result.categories.find((c) => c.key === "requiredSkillMatch")!;
    expect(requiredCategory.score).toBeLessThan(requiredCategory.maxScore);
  });

  it("flags a location/eligibility issue for an on-site role in a different city, but not for remote", () => {
    const onsite = calculateJobAtsMatch(profile(), job({ workMode: "ONSITE", location: "San Francisco, CA" }), 0.9);
    expect(onsite.eligibilityIssues.length).toBeGreaterThan(0);

    const remote = calculateJobAtsMatch(profile(), job({ workMode: "REMOTE", location: "San Francisco, CA" }), 0.9);
    expect(remote.eligibilityIssues).toHaveLength(0);
    const remoteLocationCategory = remote.categories.find((c) => c.key === "locationEligibility")!;
    expect(remoteLocationCategory.score).toBe(remoteLocationCategory.maxScore);
  });

  it("treats Staff Nurse as a professional title and warns when stated registration is unconfirmed", () => {
    const nursingText = `Priya Rao
Staff Nurse | Bengaluru, India

SUMMARY
Patient care professional with ward and ICU experience.

EXPERIENCE
Staff Nurse | Community Hospital | 2024 - Present
- Delivered patient care and maintained clinical records.

EDUCATION
BSc Nursing | State Nursing College | 2024

SKILLS
Patient Care, ICU, Ward Care`;
    const nursingProfile = extractCareerProfile(
      parseResumeStructure(nursingText, {
        mediaType: "text/plain",
        parser: "test",
      })
    );
    const result = calculateJobAtsMatch(
      nursingProfile,
      job({
        title: "Staff Nurse",
        description:
          "BSc Nursing or GNM with registration at the State Nursing Council. Ward patient care.",
        requiredSkills: ["Patient Care"],
        preferredSkills: ["ICU"],
        experienceMin: 0,
        experienceMax: 2,
      }),
      0.9
    );
    expect(result.eligibilityIssues).toEqual([
      expect.stringMatching(/registration was not confirmed/i),
    ]);
    expect(result.hardBlockers).toHaveLength(0);
  });

  it("stamps the current score version and total is always within 0-100", () => {
    const result = calculateJobAtsMatch(profile(), job(), 0.9);
    expect(result.scoreVersion).toBe(JOB_ATS_MATCH_VERSION);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });
});
