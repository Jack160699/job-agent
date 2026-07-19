import { readFile } from "node:fs/promises";
import { join } from "node:path";
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import type { ParsedCareerProfile } from "@/lib/resumes/career-profile";
import {
  getResumeTemplate,
  type ResumeLength,
  type ResumeTemplateId,
} from "@/lib/resumes/templates";

export interface ResumePdfInput {
  title: string;
  rawText: string;
  skills?: string[];
  highlights?: string[];
  profile?: ParsedCareerProfile | null;
  template?: ResumeTemplateId;
  length?: ResumeLength;
}

interface ResumeSection {
  key: string;
  heading: string;
  lines: string[];
}

interface EmbeddedFonts {
  latin: PDFFont;
  latinBold: PDFFont;
  devanagari: PDFFont;
  devanagariBold: PDFFont;
}

const regularFontPath = join(
  process.cwd(),
  "node_modules",
  "@expo-google-fonts",
  "noto-sans-devanagari",
  "400Regular",
  "NotoSansDevanagari_400Regular.ttf"
);
const boldFontPath = join(
  process.cwd(),
  "node_modules",
  "@expo-google-fonts",
  "noto-sans-devanagari",
  "700Bold",
  "NotoSansDevanagari_700Bold.ttf"
);
const FONT_FILES = {
  latin: regularFontPath,
  latinBold: boldFontPath,
  devanagari: regularFontPath,
  devanagariBold: boldFontPath,
} as const;

function cleanText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(values: Array<string | null | undefined>, separator = " · "): string {
  return values.map((value) => cleanText(value ?? "")).filter(Boolean).join(separator);
}

function buildSections(input: ResumePdfInput): ResumeSection[] {
  const profile = input.profile;
  if (!profile) {
    const lines = input.rawText
      .split(/\r?\n/)
      .map(cleanText)
      .filter(Boolean);
    return [
      ...(input.highlights?.length
        ? [{ key: "highlights", heading: "Key Highlights", lines: input.highlights }]
        : []),
      ...(input.skills?.length
        ? [{ key: "skills", heading: "Skills", lines: [input.skills.join(", ")] }]
        : []),
      { key: "resume", heading: "Resume", lines },
    ];
  }

  const sections: ResumeSection[] = [];
  if (profile.professionalSummary.value) {
    sections.push({
      key: "summary",
      heading: "Professional Summary",
      lines: [profile.professionalSummary.value],
    });
  }
  if (profile.skills.value.length > 0) {
    sections.push({
      key: "skills",
      heading: "Skills",
      lines: [profile.skills.value.join(", ")],
    });
  }
  if (profile.experience.value.length > 0) {
    sections.push({
      key: "experience",
      heading: "Work Experience",
      lines: profile.experience.value.flatMap((entry) => {
        const dateRange = compact(
          [entry.startDate, entry.current ? "Present" : entry.endDate],
          " – "
        );
        const heading = compact([
          entry.title,
          entry.company ? `at ${entry.company}` : null,
          entry.location,
          dateRange,
        ]);
        return [heading, ...(entry.description ? [`• ${entry.description}`] : [])];
      }),
    });
  }
  if (profile.projects.value.length > 0) {
    sections.push({
      key: "projects",
      heading: "Projects",
      lines: profile.projects.value.flatMap((entry) => [
        compact([entry.name, entry.technologies.join(", ")]),
        ...(entry.description ? [`• ${entry.description}`] : []),
      ]),
    });
  }
  if (profile.education.value.length > 0) {
    sections.push({
      key: "education",
      heading: "Education",
      lines: profile.education.value.map((entry) =>
        compact([
          entry.degree,
          entry.field,
          entry.institution,
          compact([entry.startDate, entry.endDate], " – "),
        ])
      ),
    });
  }
  if (profile.certifications.value.length > 0) {
    sections.push({
      key: "certifications",
      heading: "Certifications",
      lines: profile.certifications.value.map((item) => `• ${item}`),
    });
  }
  if (profile.languages.value.length > 0) {
    sections.push({
      key: "languages",
      heading: "Languages",
      lines: [profile.languages.value.join(", ")],
    });
  }
  return sections;
}

async function embedFonts(doc: PDFDocument): Promise<EmbeddedFonts> {
  doc.registerFontkit(fontkit);
  const [latin, latinBold, devanagari, devanagariBold] = await Promise.all(
    Object.values(FONT_FILES).map((path) => readFile(path))
  );
  return {
    latin: await doc.embedFont(Uint8Array.from(latin), { subset: true }),
    latinBold: await doc.embedFont(Uint8Array.from(latinBold), { subset: true }),
    devanagari: await doc.embedFont(Uint8Array.from(devanagari), { subset: true }),
    devanagariBold: await doc.embedFont(Uint8Array.from(devanagariBold), {
      subset: true,
    }),
  };
}

function fontFor(text: string, fonts: EmbeddedFonts, bold: boolean): PDFFont {
  const devanagari = /[\u0900-\u097F]/.test(text);
  if (devanagari) return bold ? fonts.devanagariBold : fonts.devanagari;
  return bold ? fonts.latinBold : fonts.latin;
}

function splitIntoRuns(text: string): string[] {
  return text.match(/[\u0900-\u097F]+|[^\u0900-\u097F]+/g) ?? [text];
}

function widthOf(text: string, fonts: EmbeddedFonts, size: number, bold: boolean): number {
  return splitIntoRuns(text).reduce(
    (sum, run) => sum + fontFor(run, fonts, bold).widthOfTextAtSize(run, size),
    0
  );
}

function wrapText(
  value: string,
  fonts: EmbeddedFonts,
  size: number,
  maxWidth: number,
  bold = false
): string[] {
  const words = cleanText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && widthOf(candidate, fonts, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawMixedText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
  fonts: EmbeddedFonts,
  bold: boolean,
  color: ReturnType<typeof rgb>
) {
  let cursor = x;
  for (const run of splitIntoRuns(value)) {
    const font = fontFor(run, fonts, bold);
    page.drawText(run, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(run, size);
  }
}

export async function generateResumePdf(input: ResumePdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const template = getResumeTemplate(input.template ?? "ats-classic");
  const maxPages = input.length === "one-page" ? 1 : 2;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = input.length === "one-page" ? 38 : 46;
  const bodySize = input.length === "one-page" ? 8.8 : 9.6;
  const lineHeight = input.length === "one-page" ? 11.3 : 12.5;
  const maxWidth = pageWidth - margin * 2;
  const accent = rgb(...template.accent);
  const ink = rgb(0.08, 0.11, 0.17);
  const muted = rgb(0.32, 0.38, 0.46);
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let exhausted = false;

  const newPage = () => {
    if (doc.getPageCount() >= maxPages) {
      exhausted = true;
      return false;
    }
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    return true;
  };

  const ensureSpace = (height: number) => {
    if (y - height >= margin) return true;
    return newPage();
  };

  const drawWrapped = (
    value: string,
    options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}
  ) => {
    if (exhausted) return;
    const size = options.size ?? bodySize;
    const bold = options.bold ?? false;
    const indent = options.indent ?? 0;
    const lines = wrapText(value, fonts, size, maxWidth - indent, bold);
    for (const line of lines) {
      if (!ensureSpace(lineHeight)) return;
      drawMixedText(
        page,
        line,
        margin + indent,
        y,
        size,
        fonts,
        bold,
        options.color ?? ink
      );
      y -= lineHeight;
    }
  };

  const profile = input.profile;
  const displayName = cleanText(profile?.fullName.value || input.title);
  drawWrapped(displayName, { size: 18, bold: true, color: accent });
  const identityLine = compact([
    profile?.currentRole.value,
    profile?.currentLocation.value,
  ]);
  if (identityLine) drawWrapped(identityLine, { size: 10.5, bold: true, color: ink });
  const contactLine = compact([
    profile?.email.value,
    profile?.phone.value,
    profile?.linkedinUrl.value,
    profile?.githubUrl.value,
    profile?.portfolioUrl.value,
  ]);
  if (contactLine) drawWrapped(contactLine, { size: 8.4, color: muted });
  y -= 5;

  const sectionMap = new Map(buildSections(input).map((section) => [section.key, section]));
  const orderedSections = [
    ...template.sectionOrder.map((key) => sectionMap.get(key)).filter(Boolean),
    ...Array.from(sectionMap.values()).filter(
      (section) => !template.sectionOrder.includes(section.key)
    ),
  ] as ResumeSection[];

  for (const section of orderedSections) {
    if (exhausted || section.lines.every((line) => !cleanText(line))) continue;
    if (!ensureSpace(30)) break;
    y -= 3;
    if (template.headingStyle === "filled") {
      page.drawRectangle({
        x: margin,
        y: y - 3,
        width: maxWidth,
        height: 16,
        color: rgb(
          Math.min(template.accent[0] + 0.89, 0.97),
          Math.min(template.accent[1] + 0.61, 0.96),
          Math.min(template.accent[2] + 0.18, 0.98)
        ),
      });
      drawWrapped(section.heading.toUpperCase(), { size: 9.2, bold: true, color: accent });
    } else {
      drawWrapped(section.heading.toUpperCase(), { size: 9.2, bold: true, color: accent });
      if (template.headingStyle === "rule") {
        page.drawLine({
          start: { x: margin, y: y + 5 },
          end: { x: pageWidth - margin, y: y + 5 },
          thickness: 0.7,
          color: accent,
        });
      }
    }
    y -= 2;
    for (const value of section.lines) {
      if (!cleanText(value)) continue;
      const bullet = value.trimStart().startsWith("•");
      drawWrapped(value, { indent: bullet ? 7 : 0 });
      if (exhausted) break;
    }
    y -= 4;
  }

  doc.setTitle(`${displayName} — ${template.name}`);
  doc.setSubject("Kairela resume export");
  doc.setProducer("Kairela");
  doc.setCreator("Kairela");
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function generateCoverLetterPdf(content: string, title: string): Promise<Buffer> {
  return generateResumePdf({
    title,
    rawText: content,
    template: "ats-classic",
    length: "two-page",
  });
}
