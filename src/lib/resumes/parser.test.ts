import { describe, expect, it } from "vitest";
import {
  parseResumeFile,
  parseResumeStructure,
  reconstructPdfTextItems,
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

  it("preserves PDF line boundaries used by structured resume extraction", () => {
    const reconstructed = reconstructPdfTextItems([
      {
        str: "Jane Doe",
        hasEOL: true,
        transform: [10, 0, 0, 10, 40, 760],
      },
      {
        str: "Software Engineer | Pune, India",
        hasEOL: true,
        transform: [10, 0, 0, 10, 40, 744],
      },
      {
        str: "EXPERIENCE",
        hasEOL: true,
        transform: [10, 0, 0, 10, 40, 712],
      },
      {
        str: "Senior Engineer | Acme | 2021 - Present",
        hasEOL: true,
        transform: [10, 0, 0, 10, 40, 696],
      },
    ]);

    expect(reconstructed).toBe(
      "Jane Doe\nSoftware Engineer | Pune, India\nEXPERIENCE\nSenior Engineer | Acme | 2021 - Present"
    );
    expect(
      parseResumeStructure(`${reconstructed}\n\nSKILLS\nTypeScript, React, SQL`, {
        mediaType: "application/pdf",
        parser: "unpdf",
      }).content.sections.map((section) => section.heading)
    ).toContain("EXPERIENCE");
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

  it("rejects an empty file", async () => {
    await expect(
      parseResumeFile({ name: "resume.txt", type: "text/plain", bytes: new Uint8Array(0) })
    ).rejects.toThrow("empty");
  });

  it("rejects a file larger than the 5 MB limit", async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    await expect(
      parseResumeFile({ name: "resume.txt", type: "text/plain", bytes: oversized })
    ).rejects.toThrow("5 MB or smaller");
  });

  it("rejects a DOCX-extension file whose bytes are not a real DOCX (magic-byte mismatch)", async () => {
    await expect(
      parseResumeFile({
        name: "resume.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: new TextEncoder().encode(resumeText),
      })
    ).rejects.toThrow("valid PDF, DOCX, or plain-text");
  });
});
