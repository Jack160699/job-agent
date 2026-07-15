import { describe, expect, it } from "vitest";
import {
  parseResumeFile,
  parseResumeStructure,
} from "@/lib/resumes/parser";

const resumeText = `Jane Doe
Software Engineer

SUMMARY
Engineer with five years of experience building reliable web applications.

EXPERIENCE
Senior Engineer at Acme
- Built TypeScript and React services backed by PostgreSQL.

SKILLS
TypeScript, React, PostgreSQL, Docker`;

describe("resume parsing", () => {
  it("extracts sections and known skills without inventing content", () => {
    const parsed = parseResumeStructure(resumeText, {
      mediaType: "text/plain",
      parser: "test",
    });

    expect(parsed.content.sections.map((section) => section.heading)).toEqual([
      "Profile",
      "SUMMARY",
      "EXPERIENCE",
      "SKILLS",
    ]);
    expect(parsed.skills).toEqual(
      expect.arrayContaining(["TypeScript", "React", "PostgreSQL", "Docker"])
    );
    expect(parsed.rawText).toContain("Senior Engineer at Acme");
  });

  it("parses a UTF-8 text upload", async () => {
    const parsed = await parseResumeFile({
      name: "resume.txt",
      type: "text/plain",
      bytes: new TextEncoder().encode(resumeText),
    });

    expect(parsed.content.source.parser).toBe("utf8");
    expect(parsed.content.source.fileName).toBe("resume.txt");
  });

  it("rejects spoofed or unsupported files", async () => {
    await expect(
      parseResumeFile({
        name: "resume.pdf",
        type: "application/pdf",
        bytes: new TextEncoder().encode(resumeText),
      })
    ).rejects.toThrow("valid PDF, DOCX, or plain-text");
  });

  it("explains when extracted text is too short", () => {
    expect(() =>
      parseResumeStructure("Too short", {
        mediaType: "text/plain",
        parser: "test",
      })
    ).toThrow("Scanned PDFs require OCR");
  });
});
